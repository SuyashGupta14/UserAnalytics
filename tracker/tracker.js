/**
 * CausalFunnel User Analytics Tracking Script
 * Lightweight, zero-dependency client tracking library.
 * Tracks page views, clicks with coordinates, and session lifecycles.
 */
(function (window, document) {
  'use strict';

  // Prevent multiple initializations
  if (window.__CAUSAL_TRACKER_LOADED__) return;
  window.__CAUSAL_TRACKER_LOADED__ = true;

  // ── Configuration ──────────────────────────────────────────────────────────
  var currentScript = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var userConfig = window.CausalTrackerConfig || {};

  var scriptEndpoint = currentScript ? (currentScript.getAttribute('data-endpoint') || currentScript.getAttribute('data-api')) : null;
  var scriptDebug = currentScript ? (currentScript.getAttribute('data-debug') === 'true') : false;

  var config = {
    endpoint: userConfig.endpoint || (scriptEndpoint && scriptEndpoint.trim().length > 0 ? scriptEndpoint.trim() : '/api/events'),
    sessionDurationMs: (userConfig.sessionDurationMinutes || 30) * 60 * 1000,
    batchIntervalMs: userConfig.batchIntervalMs || 1500,
    maxBatchSize: userConfig.maxBatchSize || 10,
    debug: userConfig.debug !== undefined ? userConfig.debug : scriptDebug,
  };

  function log() {
    if (config.debug && window.console && window.console.log) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[CausalTracker]');
      window.console.log.apply(window.console, args);
    }
  }

  // ── Session Management (localStorage with Cookie fallback) ──────────────────
  var SESSION_STORAGE_KEY = 'cf_session_id';
  var SESSION_EXPIRES_KEY = 'cf_session_expires';
  var COOKIE_NAME = 'cf_session_id';

  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback pseudo-UUID
    return 'cf_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function setCookie(name, value, maxAgeSeconds) {
    document.cookie = name + '=' + encodeURIComponent(value) + '; path=/; max-age=' + maxAgeSeconds + '; SameSite=Lax';
  }

  var currentSessionId = null;

  function refreshSession() {
    var now = Date.now();
    var storedId = null;
    var expiresAt = 0;

    // Try localStorage
    try {
      storedId = window.localStorage.getItem(SESSION_STORAGE_KEY);
      expiresAt = parseInt(window.localStorage.getItem(SESSION_EXPIRES_KEY) || '0', 10);
    } catch (e) {
      // LocalStorage blocked/unavailable
    }

    // Try cookie fallback if not in localStorage
    if (!storedId) {
      storedId = getCookie(COOKIE_NAME);
    }

    // Check if session has expired
    if (!storedId || (expiresAt && now > expiresAt)) {
      currentSessionId = generateUUID();
      log('New session created:', currentSessionId);
    } else {
      currentSessionId = storedId;
    }

    var newExpiresAt = now + config.sessionDurationMs;

    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, currentSessionId);
      window.localStorage.setItem(SESSION_EXPIRES_KEY, newExpiresAt.toString());
    } catch (e) {}

    setCookie(COOKIE_NAME, currentSessionId, Math.floor(config.sessionDurationMs / 1000));

    return currentSessionId;
  }

  // Initialize session
  refreshSession();

  // ── Queue & Delivery Engine ─────────────────────────────────────────────────
  var queue = [];
  var flushTimer = null;

  function flush(sync) {
    if (queue.length === 0) return;

    var batch = queue.splice(0, queue.length);
    log('Flushing batch of', batch.length, 'events');

    var payload = JSON.stringify(batch);

    // If sync requested (e.g., pagehide/unload), prefer sendBeacon
    if (sync && navigator.sendBeacon) {
      var blob = new Blob([payload], { type: 'text/plain; charset=UTF-8' });
      var sent = navigator.sendBeacon(config.endpoint, blob);
      if (sent) return;
    }

    // Standard async delivery
    if (typeof fetch === 'function') {
      fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(function (err) {
        log('Failed to deliver events:', err);
        // Put events back at front of queue if network failed (capped to avoid memory overflow)
        if (queue.length < 100) {
          queue = batch.concat(queue);
        }
      });
    } else {
      // Fallback XMLHttpRequest
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', config.endpoint, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(payload);
      } catch (err) {
        log('XHR delivery error:', err);
      }
    }
  }

  function enqueue(event) {
    refreshSession();
    queue.push(event);

    if (queue.length >= config.maxBatchSize) {
      if (flushTimer) clearTimeout(flushTimer);
      flush(false);
    } else if (!flushTimer) {
      flushTimer = setTimeout(function () {
        flushTimer = null;
        flush(false);
      }, config.batchIntervalMs);
    }
  }

  // ── Dimensions & Target Metadata Helpers ────────────────────────────────────
  function getPageDimensions() {
    var doc = document.documentElement;
    var body = document.body;
    return {
      viewport_w: window.innerWidth || (doc ? doc.clientWidth : 0),
      viewport_h: window.innerHeight || (doc ? doc.clientHeight : 0),
      page_w: Math.max(
        doc ? doc.scrollWidth : 0,
        doc ? doc.clientWidth : 0,
        body ? body.scrollWidth : 0,
        0
      ),
      page_h: Math.max(
        doc ? doc.scrollHeight : 0,
        doc ? doc.clientHeight : 0,
        body ? body.scrollHeight : 0,
        0
      ),
    };
  }

  function getTargetInfo(elem) {
    if (!elem || elem.nodeType !== 1) return undefined;

    // Check sensitive fields: password, credit card fields, etc.
    var isSensitive = elem.type === 'password' ||
      (elem.autocomplete && elem.autocomplete.indexOf('cc-') !== -1) ||
      elem.hasAttribute('data-cf-sensitive');

    var text = '';
    if (!isSensitive) {
      text = (elem.innerText || elem.textContent || elem.value || '').trim().substring(0, 60);
    }

    var classes = typeof elem.className === 'string' ? elem.className.trim() : '';

    return {
      tag: elem.tagName.toLowerCase(),
      id: elem.id || '',
      classes: classes,
      text: text,
    };
  }

  // ── Track API ───────────────────────────────────────────────────────────────
  function track(type, properties) {
    var dims = getPageDimensions();
    var event = {
      session_id: currentSessionId,
      type: type,
      page_url: window.location.href,
      page_title: document.title || '',
      referrer: document.referrer || '',
      timestamp: new Date().toISOString(),
      viewport_w: dims.viewport_w,
      viewport_h: dims.viewport_h,
      page_w: dims.page_w,
      page_h: dims.page_h,
    };

    if (properties) {
      for (var key in properties) {
        if (Object.prototype.hasOwnProperty.call(properties, key)) {
          event[key] = properties[key];
        }
      }
    }

    enqueue(event);
  }

  function trackPageView() {
    track('page_view');
  }

  // ── Event Listeners ─────────────────────────────────────────────────────────
  // 1. Click Listener (Capture phase to catch all clicks)
  document.addEventListener(
    'click',
    function (e) {
      try {
        var pageX = e.pageX !== undefined ? e.pageX : e.clientX + (document.documentElement.scrollLeft || (document.body ? document.body.scrollLeft : 0));
        var pageY = e.pageY !== undefined ? e.pageY : e.clientY + (document.documentElement.scrollTop || (document.body ? document.body.scrollTop : 0));

        var targetElem = e.target;
        var targetInfo = getTargetInfo(targetElem);

        track('click', {
          x: Math.round(pageX),
          y: Math.round(pageY),
          target: targetInfo,
        });
      } catch (err) {
        log('Error tracking click:', err);
      }
    },
    true
  );

  // 2. Initial Page View
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    trackPageView();
  } else {
    document.addEventListener('DOMContentLoaded', trackPageView);
  }

  // 3. SPA Navigation Support (History API + popstate)
  var lastUrl = window.location.href;
  function checkUrlChange() {
    var newUrl = window.location.href;
    if (newUrl !== lastUrl) {
      lastUrl = newUrl;
      trackPageView();
    }
  }

  var originalPushState = history.pushState;
  if (originalPushState) {
    history.pushState = function () {
      originalPushState.apply(this, arguments);
      checkUrlChange();
    };
  }

  var originalReplaceState = history.replaceState;
  if (originalReplaceState) {
    history.replaceState = function () {
      originalReplaceState.apply(this, arguments);
      checkUrlChange();
    };
  }

  window.addEventListener('popstate', checkUrlChange);

  // 4. Flush on tab close / hide
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      flush(true);
    }
  });

  window.addEventListener('pagehide', function () {
    flush(true);
  });

  // ── Public Global API ───────────────────────────────────────────────────────
  window.CausalTracker = {
    track: track,
    pageView: trackPageView,
    getSessionId: function () {
      return currentSessionId;
    },
    flush: function () {
      flush(false);
    },
    config: config,
  };

  log('Initialized with session:', currentSessionId);
})(window, document);
