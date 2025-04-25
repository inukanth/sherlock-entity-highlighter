// ==UserScript==
// @name         SBV Sherlock Entity ID Highlighter 
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Entity ID highlighter with remote configuration
// @author       Inayat Kanth
// @match        https://sherlock-clicks.amazon.com/tasker/*
// @match        https://*.sherlock-clicks.amazon.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @updateURL    https://raw.githubusercontent.com/YourGitHubUsername/sherlock-entity-highlighter/main/sherlock-entity-highlighter.user.js
// @downloadURL  https://raw.githubusercontent.com/YourGitHubUsername/sherlock-entity-highlighter/main/sherlock-entity-highlighter.user.js
// ==/UserScript==

(function() {
    'use strict';
    
    // ====== DEFAULT CONFIGURATION ======
    
    // Default entity IDs - these will be used if remote fetch fails
    const defaultEntityIds = [
        'ENTITY8PY6YS3KUYI',
        'ENTITY3QC3QUMCNO777', 
        'ENTITY2JWP2XAWY2VV2',
        'ENTITY30V4GQNAZQN5V',
        'ENTITY1SX33X4DOXCAU'
    ];
    
    // Default message - this will be used if remote fetch fails
    const defaultMessage = 'IMPORTANT: This entity requires special attention! Contact Inayat for assistance.';
    
    // Remote config URL - replace with your own GitHub repository
    const configUrl = 'https://raw.githubusercontent.com/YourGitHubUsername/sherlock-entity-highlighter/main/config.json';
    
    // How often to check for config updates (in milliseconds)
    const configUpdateInterval = 24 * 60 * 60 * 1000; // 24 hours
    
    // ====== END DEFAULT CONFIGURATION ======
    
    // Current configuration - start with defaults
    let currentConfig = {
        entityIds: defaultEntityIds,
        message: defaultMessage,
        lastUpdated: 0 // Timestamp for last update
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
    `);
    
    // Global variables
    let banner = null;
    let activeEntityId = null;
    
    // Load config from localStorage
    function loadLocalConfig() {
        try {
            const savedConfig = localStorage.getItem('entityHighlighterConfig');
            if (savedConfig) {
                const parsedConfig = JSON.parse(savedConfig);
                
                // If saved config is valid, use it
                if (parsedConfig && 
                    parsedConfig.entityIds && 
                    parsedConfig.message && 
                    parsedConfig.lastUpdated) {
                    
                    currentConfig = parsedConfig;
                    console.log('Loaded config from localStorage:', currentConfig);
                }
            }
        } catch (error) {
            console.error('Error loading config from localStorage:', error);
        }
    }
    
    // Save config to localStorage
    function saveLocalConfig() {
        try {
            localStorage.setItem('entityHighlighterConfig', JSON.stringify(currentConfig));
            console.log('Saved config to localStorage');
        } catch (error) {
            console.error('Error saving config to localStorage:', error);
        }
    }
    
    // Fetch remote config
    function fetchRemoteConfig() {
        // Only fetch if it's been more than the update interval
        const now = Date.now();
        if (now - currentConfig.lastUpdated < configUpdateInterval) {
            console.log('Using cached config, next update in', 
                        Math.round((configUpdateInterval - (now - currentConfig.lastUpdated)) / 1000 / 60), 
                        'minutes');
            return;
        }
        
        console.log('Fetching remote config...');
        
        // Use GM_xmlhttpRequest to avoid CORS issues
        GM_xmlhttpRequest({
            method: 'GET',
            url: configUrl,
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        const config = JSON.parse(response.responseText);
                        
                        // Validate config
                        if (config && 
                            Array.isArray(config.entityIds) && 
                            config.entityIds.length > 0 && 
                            typeof config.message === 'string') {
                            
                            // Update config
                            currentConfig.entityIds = config.entityIds;
                            currentConfig.message = config.message;
                            currentConfig.lastUpdated = now;
                            
                            // Save to localStorage
                            saveLocalConfig();
                            
                            console.log('Updated config from remote:', config);
                            
                            // Re-check entity IDs with new config
                            checkForEntityIds();
                        } else {
                            console.error('Invalid remote config format');
                        }
                    } catch (error) {
                        console.error('Error parsing remote config:', error);
                    }
                } else {
                    console.error('Failed to fetch remote config, status:', response.status);
                }
            },
            onerror: function(error) {
                console.error('Error fetching remote config:', error);
            }
        });
    }
    
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
    
    // Initialize
    function init() {
        console.log('Sherlock Entity ID Highlighter started');
        
        // Load config from localStorage first
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
        setInterval(fetchRemoteConfig, 60 * 60 * 1000); // Check every hour
    }
    
    // Run when the document is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
