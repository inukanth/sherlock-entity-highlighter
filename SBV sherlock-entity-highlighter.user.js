// ==UserScript==
// @name         Sherlock Entity ID Highlighter (Remote Config)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Entity ID highlighter with remote configuration for real-time updates
// @author       Inayat Kanth
// @match        https://sherlock-clicks.amazon.com/tasker/*
// @match        https://*.sherlock-clicks.amazon.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @updateURL    https://raw.githubusercontent.com/inukanth/sherlock-entity-highlighter/main/sherlock-entity-highlighter.user.js
// @downloadURL  https://raw.githubusercontent.com/inukanth/sherlock-entity-highlighter/main/sherlock-entity-highlighter.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ====== DEFAULT CONFIGURATION ======
    // These will be used as fallback if remote config fails

    // Default entity IDs
    const defaultEntityIds = [
        'ENTITY8PY6YS3KUYI',
        'ENTITY3QC3QUMCNO777',
        'ENTITY1QD5BMBH1FGDC',
        'ENTITY30V4GQNAZQN5V',
        'ENTITY1SX33X4DOXCAU'
    ];

    // Default message
    const defaultMessage = 'IMPORTANT: This entity requires special attention! Contact Inayat for assistance.';

    // Remote config URL - replace 'inukanth' with your GitHub username
    const configUrl = 'https://raw.githubusercontent.com/inukanth/sherlock-entity-highlighter/main/config.json';

    // How often to check for config updates (in milliseconds)
    const configRefreshInterval = 30 * 1000; // Every 30 seconds
    
    // ====== END DEFAULT CONFIGURATION ======

    // Current configuration (start with defaults)
    let currentConfig = {
        entityIds: defaultEntityIds,
        message: defaultMessage,
        lastUpdated: 0
    };

    // Add basic CSS
    GM_addStyle(`
        .entity-banner {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background-color: #FF5733;
            color: white;
            z-index: 9999;
            padding: 10px;
            text-align: center;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .close-button {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 16px;
            padding: 0 5px;
        }
        
        .highlighted-entity {
            background-color: yellow !important;
            color: black !important;
            font-weight: bold !important;
            padding: 0 2px !important;
            border: 1px solid orange !important;
            border-radius: 3px !important;
            display: inline !important;
        }
    `);

    // Global variables
    let banner = null;
    let activeEntityId = null;
    
    // Debug logging function - helps with troubleshooting
    function debug(message, ...data) {
        console.log(`[Entity Highlighter] ${message}`, ...data);
    }

    // ====== REMOTE CONFIG FUNCTIONS ======
    
    // Load config from localStorage (cached config)
    function loadLocalConfig() {
        try {
            const savedConfig = localStorage.getItem('entityHighlighterConfig');
            if (savedConfig) {
                const parsedConfig = JSON.parse(savedConfig);
                
                // Validate the config has required properties
                if (parsedConfig && 
                    Array.isArray(parsedConfig.entityIds) && 
                    typeof parsedConfig.message === 'string' &&
                    parsedConfig.lastUpdated) {
                    
                    currentConfig = parsedConfig;
                    debug('Loaded config from cache:', currentConfig);
                    return true;
                }
            }
        } catch (error) {
            debug('Error loading cached config:', error);
        }
        return false;
    }
    
    // Save config to localStorage
    function saveLocalConfig() {
        try {
            localStorage.setItem('entityHighlighterConfig', JSON.stringify(currentConfig));
            debug('Saved config to cache');
            return true;
        } catch (error) {
            debug('Error saving config to cache:', error);
            return false;
        }
    }
    
    // Fetch remote config from GitHub
    function fetchRemoteConfig() {
        // Only fetch if it's been at least 30 seconds since last update
        const now = Date.now();
        if (now - currentConfig.lastUpdated < configRefreshInterval) {
            debug('Using cached config, next check in', 
                Math.round((configRefreshInterval - (now - currentConfig.lastUpdated)) / 1000), 
                'seconds');
            return;
        }
        
        debug('Fetching remote configuration from GitHub');
        
        GM_xmlhttpRequest({
            method: 'GET',
            url: configUrl,
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        const config = JSON.parse(response.responseText);
                        
                        // Validate the config
                        if (config && 
                            Array.isArray(config.entityIds) && 
                            config.entityIds.length > 0 &&
                            typeof config.message === 'string') {
                            
                            // Update current config
                            currentConfig.entityIds = config.entityIds;
                            currentConfig.message = config.message;
                            currentConfig.lastUpdated = now;
                            
                            // Save to cache
                            saveLocalConfig();
                            
                            debug('Updated configuration from remote:', config);
                            
                            // Re-check page with new config
                            checkForEntityIds();
                        } else {
                            debug('Invalid remote config format:', config);
                        }
                    } catch (error) {
                        debug('Error parsing remote config:', error);
                    }
                } else {
                    debug('Failed to fetch remote config, status:', response.status);
                }
            },
            onerror: function(error) {
                debug('Error fetching remote config:', error);
            }
        });
    }

    // ====== UI AND HIGHLIGHT FUNCTIONS ======

    // Create or update banner
    function createBanner(entityId) {
        // Remove any existing banner
        if (banner) {
            banner.remove();
        }

        // Create new banner
        banner = document.createElement('div');
        banner.className = 'entity-banner';
        banner.innerHTML = `
            <span>${currentConfig.message}</span>
            <span>Entity ID: ${entityId}</span>
            <button class="close-button">×</button>
        `;

        // Add to page
        document.body.appendChild(banner);

        // Add close button handler
        banner.querySelector('.close-button').addEventListener('click', function() {
            banner.remove();
            banner = null;
        });

        // Store current entity ID
        activeEntityId = entityId;
    }

    // Remove banner
    function removeBanner() {
        if (banner) {
            banner.remove();
            banner = null;
        }
        activeEntityId = null;
    }

    // Highlight entity IDs in text - adds yellow highlighting
    function highlightEntityIds() {
        // First remove any existing highlights
        const existingHighlights = document.querySelectorAll('.highlighted-entity');
        existingHighlights.forEach(el => {
            const parent = el.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(el.textContent), el);
                parent.normalize();
            }
        });
        
        // Find and highlight entities in text nodes
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const nodesToHighlight = [];
        let node;
        
        // First identify all text nodes with entity IDs
        while (node = walker.nextNode()) {
            // Skip empty nodes
            if (!node.textContent.trim()) continue;
            
            // Skip nodes in script, style, etc.
            const parent = node.parentElement;
            if (!parent) continue;
            
            if (parent.tagName === 'SCRIPT' || 
                parent.tagName === 'STYLE' || 
                parent.tagName === 'NOSCRIPT' ||
                parent.tagName === 'INPUT' || 
                parent.tagName === 'TEXTAREA') {
                continue;
            }
            
            // Skip our banner
            if (banner && banner.contains(parent)) {
                continue;
            }
            
            // Check if node contains any entity ID
            let containsEntity = false;
            for (const entityId of currentConfig.entityIds) {
                if (node.textContent.includes(entityId)) {
                    containsEntity = true;
                    break;
                }
            }
            
            if (containsEntity) {
                nodesToHighlight.push(node);
            }
        }
        
        // Now process each node for highlighting
        nodesToHighlight.forEach(textNode => {
            const text = textNode.textContent;
            let newHtml = text;
            
            // Replace each entity ID with highlighted version
            for (const entityId of currentConfig.entityIds) {
                if (text.includes(entityId)) {
                    // Simple string replacement (more reliable than regex)
                    newHtml = newHtml.split(entityId).join(`<span class="highlighted-entity">${entityId}</span>`);
                }
            }
            
            // Only update if changes were made
            if (newHtml !== text) {
                // Create a temporary element to hold the HTML
                const temp = document.createElement('span');
                temp.innerHTML = newHtml;
                
                // Replace the text node with our highlighted HTML
                if (textNode.parentNode) {
                    const fragment = document.createDocumentFragment();
                    while (temp.firstChild) {
                        fragment.appendChild(temp.firstChild);
                    }
                    textNode.parentNode.replaceChild(fragment, textNode);
                }
            }
        });
    }

    // ====== NAVIGATION TRACKING ======

    // Check for navigation changes
    function setupNavigationTracking() {
        // Track clicks that might navigate
        document.addEventListener('click', function(e) {
            // Look for navigation-related elements
            if (e.target.tagName === 'A' ||
                e.target.tagName === 'BUTTON' ||
                e.target.parentElement.tagName === 'A' ||
                e.target.closest('a') ||
                e.target.closest('button') ||
                e.target.getAttribute('role') === 'button') {

                // Remove banner on potential navigation
                setTimeout(removeBanner, 100);

                // Check again after navigation completes
                setTimeout(checkForEntityIds, 1000);
            }
        });

        // Track form submissions
        document.addEventListener('submit', function() {
            removeBanner();
        });

        // Track history changes
        window.addEventListener('popstate', function() {
            removeBanner();
            setTimeout(checkForEntityIds, 500);
        });

        // Track XHR requests that might indicate navigation
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function() {
            const result = originalOpen.apply(this, arguments);
            this.addEventListener('load', function() {
                // Remove banner on XHR completion which might indicate page update
                removeBanner();
                // Check again after possible content update
                setTimeout(checkForEntityIds, 500);
            });
            return result;
        };
    }

    // ====== CONTENT SCANNING ======

    // Main function to check for entity IDs
    function checkForEntityIds() {
        // Only look at visible text, not hidden elements
        const visibleText = getVisibleText();

        // Check for any of our entity IDs
        let foundEntityId = null;
        for (const entityId of currentConfig.entityIds) {
            if (visibleText.includes(entityId)) {
                foundEntityId = entityId;
                break;
            }
        }

        // Update UI based on what we found
        if (foundEntityId) {
            // Only create banner if entity ID changed or banner doesn't exist
            if (foundEntityId !== activeEntityId || !banner) {
                createBanner(foundEntityId);
            }
            
            // Highlight all instances of entity IDs
            highlightEntityIds();
        } else {
            // No entity found, remove banner
            removeBanner();
        }
    }

    // Get visible text from the page
    function getVisibleText() {
        // Get all text nodes that are visible
        const textNodes = [];
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    // Skip hidden elements
                    const element = node.parentElement;
                    if (!element) return NodeFilter.FILTER_REJECT;

                    // Skip our banner
                    if (banner && banner.contains(element)) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    // Skip script and style tags
                    if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') {
                        return NodeFilter.FILTER_REJECT;
                    }

                    // Check if element is visible
                    const style = window.getComputedStyle(element);
                    if (style.display === 'none' || style.visibility === 'hidden') {
                        return NodeFilter.FILTER_REJECT;
                    }

                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.trim()) {
                textNodes.push(node.textContent);
            }
        }

        return textNodes.join(' ');
    }

    // ====== INITIALIZATION ======

    // Initialize
    function init() {
        debug('Sherlock Entity ID Highlighter started');

        // Try to load cached config first
        loadLocalConfig();
        
        // Fetch remote config
        fetchRemoteConfig();

        // Initial check
        checkForEntityIds();

        // Set up navigation tracking
        setupNavigationTracking();

        // Check periodically for entity IDs
        setInterval(checkForEntityIds, 2000);
        
        // Check periodically for config updates
        setInterval(fetchRemoteConfig, configRefreshInterval);

        // Add additional listeners for Sherlock-specific navigation
        if (window.addEventListener) {
            window.addEventListener('load', function() {
                // Check after initial load
                setTimeout(checkForEntityIds, 1000);
            });

            // Listen for custom events that might indicate navigation
            window.addEventListener('pageshow', function() {
                removeBanner();
                setTimeout(checkForEntityIds, 500);
            });
        }
    }

    // Run when the document is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
