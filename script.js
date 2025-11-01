document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // This script sets up a single-page application for the Shogun rulebook.
    // It handles navigation, theme switching, table of contents generation,
    // mobile-specific UI, and other interactive features.
    
    // --- SCRIPT SCOPE VARIABLES ---
    let tocObserver = null;
    let mobileNavObservers = [];
    
    // --- UTILITY FUNCTIONS ---
    const getEl = (id) => document.getElementById(id);

    const throttle = (func, limit) => {
        let inThrottle;
        return function () {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    };

    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    };

    const escapeHTML = (str) => {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    };
    
    const escapeRegExp = (s) => {
        if (!s) return '';
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };
const initViewportFix = () => {
    const setVhProperty = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVhProperty();
    window.addEventListener('resize', debounce(setVhProperty, 100));
};
    // --- CORE INITIALIZATION ---
    const init = () => {
        initViewportFix();
        // --- CACHED DOM ELEMENTS ---
        const appWrapper = getEl('app-wrapper');
        const topNav = getEl('top-nav');
        const tocContainer = getEl('toc-container');
        const mobileTocToggle = getEl('mobile-toc-toggle');
        const mobileTocPanel = getEl('mobile-toc-panel');
        const mobileStickyHeader = getEl('mobile-sticky-header');
        const bottomNav = getEl('bottom-nav');

        const initThemeToggle = () => {
            const toggleBtn = getEl('theme-toggle');
            if (!toggleBtn) return;
            const sunIcon = getEl('theme-icon-sun');
            const moonIcon = getEl('theme-icon-moon');
            const savedTheme = localStorage.getItem('theme') || 'dark';

            const applyTheme = (theme) => {
                document.body.classList.toggle('light-mode', theme === 'light');
                if (sunIcon) sunIcon.classList.toggle('hidden', theme === 'dark');
                if (moonIcon) moonIcon.classList.toggle('hidden', theme === 'light');
                toggleBtn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
            };

            const toggleTheme = () => {
                const newTheme = document.body.classList.contains('light-mode') ? 'dark' : 'light';
                localStorage.setItem('theme', newTheme);
                applyTheme(newTheme);
            };

            applyTheme(savedTheme);
            toggleBtn.addEventListener('click', toggleTheme);
        };

        const initOfflineDownload = () => {
            const btn = getEl('download-offline-btn');
            if (btn) {
                btn.addEventListener('click', () => {
                    const clone = document.documentElement.cloneNode(true);
                    
                    // Reset theme to default dark for consistency
                    clone.querySelector('body').classList.remove('light-mode');
                    
                    // Reset TOC state
                    const toc = clone.querySelector('#toc-container');
                    if (toc) toc.classList.remove('is-expanded');
                    
                    // Remove dynamic padding from main content area
                    const app = clone.querySelector('#app-wrapper');
                    if (app) app.style.paddingLeft = '';

                    const fullHtml = clone.outerHTML;
                    const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
                    const a = document.createElement("a");
                    const url = URL.createObjectURL(blob);
                    a.href = url;
                    a.download = "ShogunRulebook.html";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });
            }
        };

        const showPage = (pageId) => {
            const cleanPageId = pageId.replace('#', '');
            const validTargetId = getEl(`page-${cleanPageId}`) ? cleanPageId : 'start';
            
            if (appWrapper) {
                appWrapper.querySelectorAll('.page-container').forEach(p => p.classList.remove('active'));
                const targetPage = getEl(`page-${validTargetId}`);
                if (targetPage) targetPage.classList.add('active');
            }
            
            if (topNav) {
                topNav.querySelectorAll('.nav-link').forEach(l => {
                    const hash = (l.getAttribute('href') || '').replace(/^.*#/, '#');
                    l.classList.toggle('active', hash === `#${validTargetId}`);
                });
            }

            if (bottomNav) {
                 bottomNav.querySelectorAll('.nav-icon').forEach(l => {
                    const hash = (l.getAttribute('href') || '').replace(/^.*#/, '#');
                    l.classList.toggle('active', hash === `#${validTargetId}`);
                });
            }
            
            const isContentPage = ['rules', 'modules', 'strategy', 'timing', 'reference'].includes(validTargetId);
            if (tocContainer) tocContainer.classList.toggle('js-hidden', !isContentPage);
            if (mobileStickyHeader) mobileStickyHeader.classList.toggle('js-hidden', !['rules', 'modules'].includes(validTargetId));

            // Adjust main content padding based on TOC visibility and state
            if (appWrapper && tocContainer) {
                const isTocExpanded = tocContainer.classList.contains('is-expanded');
                appWrapper.style.paddingLeft = isContentPage && window.innerWidth >= 1024 ? 
                    (isTocExpanded ? 'var(--toc-width-expanded)' : 'var(--toc-width-collapsed)') : 
                    '0';
            }

            // Only scroll to top if not navigating to a sub-section
            if (!pageId.includes('_')) {
                window.scrollTo(0, 0);
            }
        };

        const handleNavigation = () => {
            let hash = window.location.hash || '#start';
            const targetId = hash.substring(1);
            const targetElement = getEl(targetId);

            if (targetElement?.closest('.page-container')) {
                const parentPage = targetElement.closest('.page-container');
                const pageId = parentPage.id.replace('page-', '');
                showPage(`#${pageId}`);
                
                // Use requestAnimationFrame to ensure smooth scroll after page is visible
                requestAnimationFrame(() => {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                    document.querySelectorAll('.toc-link').forEach(l => l.classList.remove('active'));
                    document.querySelectorAll(`.toc-link[href="${hash}"]`).forEach(l => l.classList.add('active'));
                });
                return;
            }
            showPage(hash);
        };

        const initEventListeners = () => {
            document.body.addEventListener('click', (e) => {
                const link = e.target.closest('a');
                if (!link || !link.getAttribute('href')) return;
                
                const href = link.getAttribute('href');
                if (href.startsWith('#')) {
                     e.preventDefault();
                     window.location.hash = href;
                }
            });
            window.addEventListener('hashchange', handleNavigation);
        };

        const initTOC = () => {
            const headings = document.querySelectorAll('#app-wrapper h2[id], #app-wrapper h3[id], #app-wrapper h4[id], #app-wrapper h5[id]');
            if (headings.length === 0) return;

            let tocHTML = '';
            headings.forEach(h => {
                const level = parseInt(h.tagName.substring(1), 10);
                const indent = `pl-${(level - 2) * 4}`;
                const text = h.textContent;
                const ruleNumberMatch = text.match(/^(§\s?[\d\.]+)/);
                let ruleNumberHTML = '';
                let ruleText = text;
                
                if (ruleNumberMatch) {
                    ruleNumberHTML = `<span class="rule-number">${ruleNumberMatch[0]}</span>`;
                    ruleText = text.replace(ruleNumberMatch[0], '').trim();
                }
                tocHTML += `<li><a href="#${h.id}" class="toc-link block px-2 py-1 truncate rounded-md hover:bg-gray-700 transition-colors ${indent}">${ruleNumberHTML}${ruleText}</a></li>`;
            });
            
            const tocList = getEl('toc-list');
            const mobileTocList = getEl('mobile-toc-list');
            if (tocList) tocList.innerHTML = tocHTML;
            if (mobileTocList) mobileTocList.innerHTML = tocHTML;

            initTOCScrollspy(headings);
        };

        const initTOCScrollspy = (headings) => {
            if (!('IntersectionObserver' in window)) return;
            if (tocObserver) tocObserver.disconnect();
            
            tocObserver = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    const id = entry.target.getAttribute('id');
                    if (entry.isIntersecting) {
                        document.querySelectorAll('.toc-link').forEach(l => l.classList.remove('active'));
                        const activeLinks = document.querySelectorAll(`.toc-link[href="#${id}"]`);
                        activeLinks.forEach(l => {
                            l.classList.add('active');
                            l.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        });
                    }
                });
            }, { rootMargin: '-80px 0px -80% 0px' });

            headings.forEach(s => tocObserver.observe(s));
        };

        const initMobileNav = () => {
            const mobileClose = getEl('mobile-toc-close');
            const mobileCloseBottom = getEl('mobile-toc-close-bottom');
            if (!mobileTocToggle || !mobileTocPanel || !mobileClose || !mobileCloseBottom) return;

            mobileNavObservers.forEach(obs => obs.disconnect());
            mobileNavObservers = [];

            const openPanel = () => {
                mobileTocPanel.classList.remove('hidden');
                mobileTocToggle.setAttribute('aria-expanded', 'true');
                document.body.style.overflow = 'hidden';
                if (appWrapper) appWrapper.inert = true;
                if (topNav) topNav.inert = true;
                if (bottomNav) bottomNav.classList.add('hidden');
                mobileClose.focus();
            };

            const closePanel = () => {
                mobileTocPanel.classList.add('hidden');
                mobileTocToggle.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
                if (appWrapper) appWrapper.inert = false;
                if (topNav) topNav.inert = false;
                if (bottomNav) bottomNav.classList.remove('hidden');
                mobileTocToggle.focus();
            };

            mobileTocToggle.addEventListener('click', openPanel);
            mobileClose.addEventListener('click', closePanel);
            mobileCloseBottom.addEventListener('click', closePanel);
            mobileTocPanel.addEventListener('click', (e) => {
                if (e.target.closest('a') || e.target === mobileTocPanel) closePanel();
            });

            // Trap focus within the mobile menu
            mobileTocPanel.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closePanel();
                if (e.key === 'Tab') {
                    const focusableElements = mobileTocPanel.querySelectorAll('a[href], button:not([disabled])');
                    const firstElement = focusableElements[0];
                    const lastElement = focusableElements[focusableElements.length - 1];
                    if (e.shiftKey) {
                        if (document.activeElement === firstElement) { lastElement.focus(); e.preventDefault(); }
                    } else {
                        if (document.activeElement === lastElement) { firstElement.focus(); e.preventDefault(); }
                    }
                }
            });

            // Mobile sticky header logic
            if (!mobileStickyHeader) return;
            if (!('IntersectionObserver' in window)) return;

            const contentHeadings = appWrapper.querySelectorAll('#page-rules h2[id], #page-modules h2[id]');
            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        mobileStickyHeader.textContent = entry.target.textContent.replace(/^(§\s?[\d\.]+)/, '').trim();
                    }
                });
            }, { rootMargin: "-80px 0px -85% 0px" });
            contentHeadings.forEach(h => observer.observe(h));
            mobileNavObservers.push(observer);

            const pageObserver = new IntersectionObserver(entries => {
                const entry = entries[0];
                mobileStickyHeader.classList.toggle('visible', entry.isIntersecting && entry.intersectionRatio > 0.05);
            }, { threshold: [0.05, 0.1] });
            const rulesPage = getEl('page-rules');
            const modulesPage = getEl('page-modules');
            if (rulesPage) pageObserver.observe(rulesPage);
            if (modulesPage) pageObserver.observe(modulesPage);
            mobileNavObservers.push(pageObserver);
            
            // Hide/show top nav on scroll for mobile
            let lastScrollY = window.scrollY;
            window.addEventListener('scroll', throttle(() => {
                if (window.innerWidth < 1024) {
                    const currentScrollY = window.scrollY;
                    if (topNav) topNav.classList.toggle('top-nav--hidden', currentScrollY > lastScrollY && currentScrollY > 60);
                    lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
                } else {
                    if (topNav) topNav.classList.remove('top-nav--hidden');
                }
            }, 100), { passive: true });
        };

        const initProgressBar = () => {
            const progressBar = getEl('progress-bar');
            const contentArea = getEl('app-wrapper');
            if (!progressBar || !contentArea) return;

            const updateProgress = () => {
                const contentHeight = contentArea.scrollHeight - window.innerHeight;
                if (contentHeight <= 0) {
                    progressBar.style.width = '0%';
                    return;
                }
                const scrollPosition = window.scrollY;
                const progress = (scrollPosition / contentHeight) * 100;
                progressBar.style.width = `${Math.min(progress, 100)}%`;
            };

            window.addEventListener('scroll', throttle(updateProgress, 100), { passive: true });
            const pageObserver = new MutationObserver(debounce(updateProgress, 200));
            pageObserver.observe(contentArea, { childList: true, subtree: true, attributes: true });
            updateProgress();
        };

        const createGlossaryTooltips = (container, terms) => {
            const keys = Object.keys(terms).map(escapeRegExp);
            if (keys.length === 0) return; // <-- Add this line
            const regex = new RegExp(`\\b(${keys.join('|')})\\b`, 'gi');

            const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => {
                    if (!node.parentElement || node.parentElement.closest('script, style, strong, .tooltip, a, h1, h2, h3, h4, h5, #glossary-list')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    if (regex.test(node.textContent)) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_REJECT;
                }
            });

            const nodesToProcess = [];
            while (walker.nextNode()) nodesToProcess.push(walker.currentNode);

            nodesToProcess.forEach(node => {
                const parent = node.parentNode;
                const parts = node.textContent.split(regex);
                const fragment = document.createDocumentFragment();
                for (let i = 0; i < parts.length; i++) {
                    const text = parts[i];
                    if (i % 2 === 0) {
                        if (text) fragment.appendChild(document.createTextNode(text));
                    } else {
                        const termKey = Object.keys(terms).find(key => key.toLowerCase() === text.toLowerCase());
                        if (termKey) {
                            const span = document.createElement('span');
                            span.className = 'tooltip';
                            span.setAttribute('data-tooltip', escapeHTML(terms[termKey]));
                            span.textContent = text;
                            fragment.appendChild(span);
                        } else {
                            if (text) fragment.appendChild(document.createTextNode(text));
                        }
                    }
                }
                parent.replaceChild(fragment, node);
            });
        };

const initMisc = () => {
            // Back to top button
            const btn = getEl('back-to-top');
            if (btn) {
                window.addEventListener('scroll', throttle(() => {
                    btn.style.display = window.scrollY > 400 ? 'flex' : 'none'
                }, 200), { passive: true });
                btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
            }

            // Glossary & Tooltips
            const glossaryList = getEl('glossary-list');
            if (!glossaryList) return;

            const terms = {};
            glossaryList.querySelectorAll('li').forEach(item => {
                const termEl = item.querySelector('strong');
                if(termEl) {
                    const term = termEl.textContent.trim().replace(/:$/, '');
                    const clone = item.cloneNode(true);
                    clone.querySelector('strong').remove();
                    const definition = clone.textContent.trim();

                    if (term && definition) {
                        terms[term] = definition;
                    }
                }
            });

            if (Object.keys(terms).length > 0) {
                createGlossaryTooltips(appWrapper, terms);
            }
        };
// The NEW timing function starts HERE, completely separate.
        const initTimingModuleToggles = () => {
            const timingPage = getEl('page-timing');
            if (!timingPage) return;

            const toggles = timingPage.querySelectorAll('[data-module-toggle]');
            const allRows = timingPage.querySelectorAll('table tr');

            const updateTimingTable = () => {
                const activeModules = new Set();
                toggles.forEach(toggle => {
                    if (toggle.checked) {
                        activeModules.add(toggle.dataset.moduleToggle);
                    }
                });

                allRows.forEach(row => {
                    const moduleData = row.dataset.module;
                    const replacedByData = row.dataset.isReplacedBy;
                    let show = false;

                    if (moduleData) {
                        // This is a row added by a module
                        if (activeModules.has(moduleData)) {
                            show = true;
                        }
                    } else {
                        // This is a core rule row
                        if (!activeModules.has(replacedByData)) {
                            show = true;
                        }
                    }

                    // The header row (th) should always be visible
                    if (row.querySelector('th')) {
                        show = true;
                    }

                    row.style.display = show ? '' : 'none';
                });
            };

            toggles.forEach(toggle => {
                toggle.addEventListener('change', updateTimingTable);
            });

            // Run once on load to set the default view
            updateTimingTable();
        }; // <-- The initTimingModuleToggles function ends HERE.

const initDesktopTOC = () => {
    if (!tocContainer || !appWrapper) return;

    const toggleTOC = (expand) => {
        tocContainer.classList.toggle('is-expanded', expand);
        if (window.innerWidth >= 1024) {
            appWrapper.style.paddingLeft = expand ? 'var(--toc-width-expanded)' : 'var(--toc-width-collapsed)';
        }
        ['toc-title', 'toc-search-container', 'toc-list', 'toc-no-results'].forEach(id => {
            const el = getEl(id);
            if (el) el.classList.toggle('opacity-0', !expand);
        });
    };
    // Add this code block inside the initDesktopTOC function
const searchInput = getEl('toc-search');
const tocList = getEl('toc-list');
const tocLinks = tocList ? Array.from(tocList.getElementsByTagName('li')) : [];
const noResultsMsg = getEl('toc-no-results');

if (searchInput && tocList && noResultsMsg) {
    searchInput.addEventListener('input', debounce((e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        let visibleCount = 0;

        tocLinks.forEach(li => {
            const text = li.textContent.toLowerCase();
            // Show item if search is empty or if text includes the search term
            const isVisible = searchTerm === '' || text.includes(searchTerm);
            li.classList.toggle('hidden', !isVisible);
            if (isVisible) {
                visibleCount++;
            }
        });

        // Toggle the 'no results' message and list visibility
        noResultsMsg.classList.toggle('hidden', visibleCount > 0 || searchTerm === '');
        tocList.classList.toggle('hidden', visibleCount === 0 && searchTerm !== '');

    }, 200));
}
    const pinButton = document.createElement('button');
    pinButton.innerHTML = '▶';
    pinButton.className = 'absolute top-1/2 -translate-y-1/2 right-0 translate-x-1/2 bg-gray-800 border border-gray-700 rounded-full w-8 h-8 flex items-center justify-center z-40 hidden lg:block';
    pinButton.setAttribute('aria-label', 'Toggle Table of Contents');
    tocContainer.appendChild(pinButton);

    let isPinned = false;
    pinButton.addEventListener('click', () => {
        isPinned = !isPinned;
        pinButton.innerHTML = isPinned ? '◀' : '▶';
        toggleTOC(isPinned);
    });

    // Initialize in a collapsed state
    toggleTOC(false);
};

        const initResponsiveTables = () => {
            document.querySelectorAll('.table-responsive-wrapper').forEach(wrapper => {
                const table = wrapper.querySelector('table');
                if (!table) return;

                const checkScrollable = (wrapper, table) => {
                    if (!wrapper.classList.contains('card-view-active')) {
                         setTimeout(() => {
                            const isScrollable = table.scrollWidth > wrapper.clientWidth + 2; // 2px buffer
                            wrapper.classList.toggle('is-scrollable', isScrollable);
                        }, 100);
                    } else {
                        wrapper.classList.remove('is-scrollable');
                    }
                };

                checkScrollable(wrapper, table);
                window.addEventListener('resize', debounce(() => checkScrollable(wrapper, table), 250));
            });
        };
        
        const populateBottomNav = () => {
            if (!bottomNav) return;
            const navItems = [
                { href: '#start', label: 'Start' },
                { href: '#new-players', label: 'New Players' },
                { href: '#rules', label: 'Rules' },
                { href: '#modules', label: 'Modules' },
                { href: '#strategy', label: 'Strategy' },
                { href: '#timing', label: 'Timing' },
                { href: '#reference', label: 'Reference' },
                { href: '#feedback', label: 'Feedback' },
                { href: '#about', label: 'About' },
            ];
            
            let navHTML = '';
            navItems.forEach(item => {
                navHTML += `<a href="${item.href}" class="nav-icon">${item.label}</a>`;
            });
            bottomNav.innerHTML = navHTML;
        };

        const loadContent = () => {
            const contentMap = {
                'start': `
                <section id="page-start" class="page-container">
                    <div class="py-12 px-4">
                        <div class="max-w-4xl mx-auto">
                            <header class="text-center mb-24">
                                <h1 class="text-4xl md:text-6xl font-bold leading-tight">Shogun: Gekokujō</h1>
                                <p class="text-lg mt-2">Rulebook v83 (Living Rulebook)</p>
                            </header>
                            <section>
                                <h3 class="mt-16">A New Way to Wage War</h3>
                                <p>Welcome to a modernized classic. Shogun: Gekokujō is a deep, strategic wargame that re-engineers its 1986 predecessor for a new generation of players. It is a medium-heavy game of economic management, military conquest, and fragile alliances set in the tumultuous Sengoku period of Japan.</p>
                                <p>This living rulebook is designed to be a comprehensive guide for both aspiring warlords and seasoned veterans, providing a clear path to mastering the game's interlocking systems.</p>
                                <div class="info-card">
                                    <h3 class="!mt-0">What This Game Is (and Is Not)</h3>
                                    <ul class="list-none space-y-4">
                                        <li><strong class="text-green-400">IS:</strong> A 2-3 hour strategic euro-wargame focused on logistics and positioning.</li>
                                        <li><strong class="text-green-400">IS:</strong> A thematic experience capturing the desperate atmosphere of the Sengoku period.</li>
                                        <li><strong class="text-red-400">IS NOT:</strong> An all-day spectacle like Twilight Imperium.</li>
                                        <li><strong class="text-red-400">IS NOT:</strong> An asymmetric faction game. All clans share the same core mechanics.</li>
                                    </ul>
                                </div>
                                <div class="info-card">
                                    <h3 class="!mt-0">The Four Pillars of Power</h3>
                                    <ol class="list-none space-y-4">
                                        <li><strong>1. Gekokujō Principle:</strong> The fewer provinces you control, the earlier you act.</li>
                                        <li><strong>2. Economic Balance:</strong> Armies cost money to maintain, not just to recruit.</li>
                                        <li><strong>3. Irreplaceable Leadership:</strong> You begin with 3 Daimyō and can never recruit more.</li>
                                        <li><strong>4. The Cost of Geography:</strong> Mountains provide defense but drain your treasury.</li>
                                    </ol>
                                </div>
                                <div class="info-card">
                    <h3 class="!mt-0">Game at a Glance</h3>
                    <ul class="list-none space-y-4">
                        <li><strong class="text-accent-secondary">👥 Players:</strong> 4 for the optimal strategic experience (supports 4-5).</li>
                        <li><strong class="text-accent-secondary">⏳ Playtime:</strong> 2-3 hours (Core Game) | 3-4 hours (with Rice & War + Specialized Warfare modules).</li>
                        <li><strong class="text-accent-secondary">🎂 Age:</strong> Players aged 14+</li>
                    </ul>
                </div>
                            </section>
                            <hr class="section-divider">
                            <div class="info-card mt-20">
                                <h3 class="!mt-0">How to Learn This Game</h3>
                                <p>For your first one to two games, we strongly advise playing the Core Game <strong>without any optional modules</strong>. This will allow you to master the fundamental pillars of the game.</p>
                                <ol class="list-decimal list-inside font-semibold space-y-2">
                                        <li>Read this <a href="#start" class="nav-link-inline">Start Page</a> in full.</li>
                                        <li>Next, go to the <a href="#new-players" class="nav-link-inline">New Players</a> page. It contains high-level concepts and practical tools for your first game night.</li>
                                        <li>Finally, read <a href="#rules" class="nav-link-inline">The Rules</a> page for the complete, detailed mechanics.</li>
                                        <li>For your first game, ignore <a href="#modules" class="nav-link-inline">The Modules</a>.</li>
                                    </ol>
                                <p>For a strategically balanced first game, we recommend players choose from: <strong>Oda, Shimazu, Tokugawa, and Uesugi.</strong></p>
                            </div>
                            <hr class="section-divider">
                            <section id="changelog">
                                <h2 class="!mt-0">What's New? (Changelog)</h2>
                                <details class="bg-gray-800 p-4 rounded-lg mb-4" open>
    <summary class="cursor-pointer font-semibold">Changes in v82 (Current)</summary>
    <ul class="list-disc list-inside mt-4 space-y-3">
        <li>
            <strong>Complete Rework (§ 10.1 Political Play & Blood Feud):</strong> This module has been entirely redesigned from the ground up. It now features a high-stakes <strong>Koku pledge system</strong> and introduces the permanent <strong>"Blood Feud"</strong> mechanic as a severe, lasting consequence for betrayal, replacing the previous, simpler rule.
        </li>
        <li>
            <strong>Complete Rework (§ 10.6 The Nanban Trade):</strong> This module's mechanic has been completely changed. The previous random pre-battle effect has been replaced with a system that requires the <strong>Specialized Warfare</strong> module. Players can now pay a high one-time cost to unlock the powerful but expensive <strong>Arquebusier</strong> gunpowder unit.
        </li>
        <li>
            <strong>Vassalage System Expansion (§ 8.1):</strong> The two "Paths to Liberation" for a defeated player have been significantly expanded with detailed, specific mechanics. This includes concrete rules for the <strong>Gekokujō Assault's</strong> Ronin hiring and the <strong>Daimyō's Ransom's</strong> three distinct methods of accumulating Koku.
        </li>
        <li>
            <strong>Major Clarity Update (§ 10.3 The Cycle of Rice and War):</strong> The rules for this complex economic module have been restructured for clarity. The update adds explicit definitions for Koku states (Treasury, Sown, Stored) and provides a detailed, step-by-step breakdown of the modified round structure to remove ambiguity.
        </li>
         <li>
            <strong>Terminology Update (§ 10.7 The Emperor's Favor):</strong> The resource gained from controlling Kyoto has been thematically renamed from "Honor" to <strong>"Legitimacy"</strong>.
        </li>
    </ul>
</details>
                                <details class="bg-gray-800 p-4 rounded-lg mb-4" open>
                                    <summary class="cursor-pointer font-semibold">Changes in v79 (Current)</summary>
                                    <ul class="list-disc list-inside mt-4 space-y-3">
                                        <li>
                                            <strong>Rule Clarity (§ 1.1.2):</strong> Refined the wording for the timing of victory condition checks to improve precision and remove ambiguity.
                                        </li>
                                    </ul>
                                </details>
                                <details class="bg-gray-800 p-4 rounded-lg mb-4">
                                    <summary class="cursor-pointer font-semibold">History: Changes in v78</summary>
                                    <ul class="list-disc list-inside mt-4 space-y-3">
                                        <li>
                                            <strong>Content Enrichment (§9.1 ref):</strong> Added 10 new key terms to the Glossary based on playtester feedback to improve clarity for nuanced rules. These terms now have interactive tooltips throughout the document.
                                        </li>
                                    </ul>
                                </details>
                                <details class="bg-gray-800 p-4 rounded-lg mb-4">
                                    <summary class="cursor-pointer font-semibold">History: Changes in v77</summary>
                                    <ul class="list-disc list-inside mt-4 space-y-3">
                                        <li>
                                            <strong>Improved Clarity (§2.2.2):</strong> Rewrote the draft procedure with a clearer, step-by-step guide to make it more accessible for players unfamiliar with drafting mechanics.
                                        </li>
                                    </ul>
                                </details>
                                <details class="bg-gray-800 p-4 rounded-lg mb-4">
                                    <summary class="cursor-pointer font-semibold">History: Changes in v76</summary>
                                    <ul class="list-disc list-inside mt-4 space-y-3">
                                        <li>
                                            <strong>Thematic Renaming (§2.2):</strong> The clan selection draft is now called "The Eve of War" to better reflect the pre-conflict tension.
                                        </li>
                                    </ul>
                                </details>
                                <details class="bg-gray-800 p-4 rounded-lg">
                                    <summary class="cursor-pointer font-semibold">History: Changes in v75</summary>
                                    <ul class="list-disc list-inside mt-4 space-y-3">
                                        <li>
                                            <strong>Rule Clarity (§0.1):</strong> Clarified the "Rule of the Highest Source" to define what constitutes a bonus "type" and provided a clear example.
                                        </li>
                                        <li>
                                            <strong>Rule Clarity (§6.1 & §10.1):</strong> Refined the stacking limit rules for both standard movement and allied units to remove ambiguity.
                                        </li>
                                        <li>
                                            <strong>Rule Clarity (§6.2.1):</strong> Clarified the combat sequence to ensure simultaneous casualty removal is unambiguous.
                                        </li>
                                        <li>
                                            <strong>Document Cohesion:</strong> Corrected inconsistent section numbering and cross-references throughout the Modules chapter.
                                        </li>
                                            <li>
                                            <strong>New Player Experience:</strong> Replaced an incorrect and misleading table in the "New Players" guide with an accurate Combat quick-reference chart.
                                        </li>
                                    </ul>
                                </details>
                            </section>
                            <hr class="section-divider">
                            <section id="veteran-changes">
                                <h2 class="!mt-0">For Veterans of the Original Game: What Has Changed?</h2>
                                <div class="pt-6">
                                    <p>If you've played the 1986 Milton Bradley classic \*Shogun\* (also known as \*Samurai Swords\* or \*Ikusa\*), you'll find the soul of the game intact, but the engine has been completely rebuilt. This version is designed to be a faster, more strategically focused euro-wargame. Here are the most impactful changes:</p>
                                    <div class="info-card mt-12">
                                        <h3 class="!mt-0">1. The Economic Engine: Unit Maintenance is Everything</h3>
                                        <p><strong>THE OLD WAY:</strong> You received Koku based on your province count and had to spend it all each round on bidding for turn order or buying units. Armies were free to maintain.</p>
                                        <p><strong>THE NEW WAY (GEKOKUJŌ):</strong> Armies now have an ongoing <strong>Unit Maintenance cost</strong> every single round (1 Koku for every 2 Bushi). This is the single most important change. Income is now a stable base amount plus Koku per province.</p>
                                        <p><strong>STRATEGIC IMPACT:</strong> You can no longer build massive, unstoppable armies ("doomstacks") without an economy to support them. The game is now a tense balancing act between military expansion and economic sustainability. An overextended army will bankrupt your clan.</p>
                                    </div>
                                    <div class="info-card">
                                        <h3 class="!mt-0">2. Turn Order: The Gekokujō Principle</h3>
                                        <p><strong>THE OLD WAY:</strong> Turn order was determined by bidding Koku for swords. The wealthiest player could often secure the first turn.</p>
                                        <p><strong>THE NEW WAY (GEKOKUJŌ):</strong> Turn order is now a core catch-up mechanic. The player with the <strong>fewest provinces</strong> goes first. This is the Gekokujō Principle: "the low overthrow the high".</p>
                                        <p><strong>STRATEGIC IMPACT:</strong> This completely inverts the power dynamic. The player in the lead is now predictable and acts last, while trailing players are given the powerful advantage of initiative. Losing a province can be a strategic choice to gain the first move in the next round.</p>
                                    </div>
                                    <div class="info-card">
                                        <h3 class="!mt-0">3. Unit & Combat Simplification</h3>
                                        <p><strong>THE OLD WAY:</strong> A detailed roster of units (Bowmen, Gunners, Swordsmen, Spearmen) with different stats, and a multi-phase combat system.</p>
                                        <p><strong>THE NEW WAY (GEKOKUJŌ):</strong> The core game abstracts all standard warriors into a single unit type: the <strong>Bushi</strong>. Combat is resolved in one single, simultaneous dice roll from both sides. The old unit complexity has been moved into an optional "Specialized Warfare" module.</p>
                                        <p class="mt-4">Additionally, this version has been rebalanced to use standard six-sided dice (d6) instead of the original's twelve-sided dice (d12) to make the game more accessible.</p>
                                        <p><strong>STRATEGIC IMPACT:</strong> Combat is much faster, more decisive, and less attritional. It raises the stakes of every battle and keeps the game moving at a brisk pace.</p>
                                    </div>
                                    <div class="info-card">
                                        <h3 class="!mt-0">4. Daimyō & Player Elimination</h3>
                                        <p><strong>THE OLD WAY:</strong> Daimyō had a complex experience track. Losing your last Daimyō meant you were eliminated from the game.</p>
                                        <p><strong>THE NEW WAY (GEKOKUJŌ):</strong> Daimyō are simplified to be incredibly powerful combat units (rolling 3 dice) without the experience track. More importantly, losing your last Daimyō no longer eliminates you. Instead, you become a <strong>Vassal</strong>—you cannot win, but you remain in the game and can fight to break free.</p>
                                        <p><strong>STRATEGIC IMPACT:</strong> The game is less punishing and keeps all players engaged until the end. Vassalage provides interesting new objectives for a defeated player, preventing feel-bad moments of early elimination.</p>
                                    </div>
                                    <div class="info-card">
                                        <h3 class="!mt-0">5. New Paths to Victory</h3>
                                        <p><strong>THE OLD WAY:</strong> Win by conquering 35 provinces.</p>
                                        <p><strong>THE NEW WAY (GEKOKUJŌ):</strong> The province count is lower (e.g., 20 for 4 players) for a shorter playtime, and there is a new, alternative victory condition: <strong>The Shōgun's Mandate</strong>. Achieve this by gaining sole control of the three key provinces of Yamashiro (Kyoto), Settsu (Osaka), and Sagami (Edo).</p>
                                        <p><strong>STRATEGIC IMPACT:</strong> This creates a second strategic focal point. Players can now pursue a "king of the hill" strategy focused on these key territories instead of a slow march across the entire map, adding more strategic diversity and a clear mid-game objective.</p>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                </section>
                `,
                'new-players': `
                <section id="page-new-players" class="page-container">
                    <div class="py-12 px-4">
                        <div class="max-w-4xl mx-auto">
                            <header>
                                <h2 class="!mt-0">First-Time Player Guide</h2>
                            </header>
<div class="info-card">
    <h3 class="!mt-0" id="map_of_japan">The Theater of War: Feudal Japan</h3>
    <p>This is the stage upon which your conquest will unfold. Understanding the terrain, the chokepoints, and the strategic value of key provinces is the first step toward becoming Shōgun.</p>
    <div class="mt-4 rounded-lg overflow-hidden border border-gray-700">
        <img src="images/japan-map-600.jpg" alt="A map of feudal Japan, showing all the provinces of the game Shogun: Gekokujo" class="w-full h-auto">
    </div>
    <p class="text-sm text-center mt-4 text-gray-400">Pay close attention to the three <strong>Mandate Provinces</strong>: Yamashiro (Kyoto), Settsu (Osaka), and Sagami (Edo). Controlling these is a direct path to victory.</p>
</div>
<hr class="section-divider">
                            <section>
                                <div class="info-card bg-gray-900 border-accent-secondary">
                                    <h3 class="!mt-0 !border-b-accent-secondary/50" id="game_night_kit">The Daimyō's Kit for Game Night</h3>
                                    <p>Everything you need to get your game started quickly after a long time away from the battlefield.</p>
                                    <h4 class="mt-8 text-accent-secondary">1. Visual Component List</h4>
<ul class="list-none space-y-2">
    <li class="flex items-center"><span class="text-2xl mr-4">🏯</span> 3 Daimyō figures per&nbsp;clan</li>
    <li class="flex items-center"><span class="text-2xl mr-4">⚔️</span> 69&nbsp;Bushi&nbsp;per&nbsp;clan</li>
    <li class="flex items-center"><span class="text-2xl mr-4">💰</span> Koku&nbsp;coins for your treasury</li>
    <li class="flex items-center"><span class="text-2xl mr-4">🛡️</span> 10 Castle pieces</li>
    <li class="flex items-center"><span class="text-2xl mr-4">🎲</span> Six-sided dice for combat</li>
</ul>
                                    <h4 class="mt-8 text-accent-secondary">2. Printable Player Aid</h4>
                                    <p>For at-the-table reference, the most important cheat sheets have been compiled into a separate, printer-friendly document. Download it here:</p>
                                    <div class="text-center mt-4">
                                        <a href="ShogunPlayerAid.html" target="\_blank" class="inline-block bg-accent-primary text-white font-bold py-3 px-6 rounded-lg no-underline hover:bg-blue-400 transition-colors">
                                            Download Player Aid (for Printing)
                                        </a>
                                    </div>
                                </div>
                                <hr class="section-divider">
                                <div class="info-card">
                                    <h3 class="!mt-0">Your Turn in 30 Seconds</h3>
                                    <p>At its heart, the gameplay loop is simple. On your turn, you will:</p>
                                    <ol class="list-decimal list-inside font-semibold space-y-2 mt-4">
                                        <li><strong>Get Paid:</strong> Collect Koku based on your provinces.</li>
                                        <li><strong>Buy Troops:</strong> Spend that Koku to recruit new Bushi.</li>
                                        <li><strong>March & Fight:</strong> Move your armies to attack enemies or claim new territory.</li>
                                    </ol>
                                    <p class="mt-4">Mastering how these three simple steps interact is the key to victory.</p>
                                </div>
                                <hr class="section-divider">
                                <h2 id="first_round_example">Example of a First Round: The Rise of the Oda</h2>
                                <p><em>Scenario: A 4-player game with Oda, Tokugawa, Uesugi, and Shimazu. As all players begin with 1 province, the first round's turn order is determined alphabetically: Oda → Shimazu → Tokugawa → Uesugi.</em></p>
                                <div class="info-card">
                                    <h4 class="!mt-0">Phase 1: Planning & Reinforcement</h4>
                                    <ol class="list-decimal list-inside space-y-2">
                                        <li><strong>Income:</strong> All players simultaneously receive 4 Koku (3 base + 1 for their starting province).</li>
                                        <li><strong>Unit Maintenance:</strong> This step is skipped on the first turn of the game. All players have 4 Koku to spend.</li>
                                        <li><strong>Recruitment (Oda's Turn):</strong> The Oda player acts first. They plan for their next turn: if they conquer one province, they will have 2 provinces, giving them 5 Koku income (3+2). Their Unit Maintenance would then be 1 Koku for 2 Bushi. To fuel an aggressive opening, Oda spends 3 Koku to recruit 3 Bushi, leaving 1 Koku in their treasury. The new Bushi are placed in their home province of Owari.</li>
                                        <li><strong>Recruitment (Other Clans):</strong> Shimazu, Tokugawa, and Uesugi take their turns, making their own calculations and recruiting forces.</li>
                                    </ol>
                                </div>
                                <div class="info-card">
                                    <h4 class="!mt-0">Phase 2: Campaign</h4>
                                    <ol class="list-decimal list-inside space-y-2">
                                        <li><strong>Movement (Oda's Turn):</strong> Oda moves 1 Daimyō and 2 Bushi from Owari into the adjacent, neutral province of Mino. Their army is now poised on the Tokugawa border.</li>
                                        <li><strong>Battle Resolution:</strong> Since Mino was unoccupied, no battle occurs. Oda now controls the province.</li>
                                    </ol>
                                </div>
                                <div class="info-card">
                                    <h4 class="!mt-0">Phase 3: Winter & Outlook</h4>
                                    <p>No player controls a mountain province, so no Winter Mountain Provisions costs are paid. At the end of the round, Oda controls 2 provinces. They have established a forward position for their next campaign, but because they now have more provinces than the others, they will likely act later in the next round due to the Gekokujō principle.</p>
                                </div>
                                <hr class="section-divider">
                                <h3>Combat Made Simple</h3>
                                <p>When armies meet, both sides roll all their dice at the same time. It's one decisive clash!</p>
                                <div class="table-responsive-wrapper">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Unit Type</th>
                                                <th>Dice Rolled</th>
                                                <th>Attack Hits On...</th>
                                                <th>Defense Hits On...</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td data-label="Unit Type"><strong>Bushi</strong> (Warrior)</td>
                                                <td data-label="Dice Rolled">1 die</td>
                                                <td data-label="Attack Hits On...">5 or 6</td>
                                                <td data-label="Defense Hits On...">6</td>
                                            </tr>
                                            <tr>
                                                <td data-label="Unit Type"><strong>Daimyō</strong> (Leader)</td>
                                                <td data-label="Dice Rolled">3 dice</td>
                                                <td data-label="Attack Hits On...">4, 5, or 6</td>
                                                <td data-label="Defense Hits On...">4, 5, or 6</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <p class="mt-4 italic text-gray-400">Note: Various factors like clan abilities or castles can modify these numbers. Remember the Golden Rule (<a href="#s0_1" class="nav-link-inline">§0.1</a>): only the single highest bonus applies!</p>
                                <hr class="section-divider">
                                <h3>What Happens if My Last Daimyō Dies? (Vassalage)</h3>
                                <p>You're not out of the game! You become a Vassal.</p>
                                <ul class="list-disc list-inside">
                                    <li><strong>Immediately:</strong> You lose half of your provinces and troops.</li>
                                    <li><strong>Your New Goal:</strong> You can no longer win, but you can break free.</li>
                                </ul>
                                <h4 class="mt-8">Choose one path to liberation:</h4>
                                <ol class="list-decimal list-inside">
                                    <li><strong>The Gekokujō Assault (Risky & Fast):</strong> For one round, spend all your Koku to hire double the Ronin. If you defeat any player's last Daimyō, you are free!</li>
                                    <li><strong>Rebuilding (Safe & Slow):</strong> Each round, put up to 3 Koku in a "Liberation Fund" At 10 Koku, you're free.</li>
                                </ol>
                                <p class="mt-4 italic text-gray-400">Note: The optional 'Path of Glory' module (<a href="#s10_4" class="nav-link-inline">§10.4</a>) offers an alternative comeback mechanic that replaces this rule.</p>
                            </section>
                        </div>
                    </div>
                </section>
                `,
                'rules': `
                <section id="page-rules" class="page-container">
                    <div class="py-12 px-4">
                        <div class="max-w-4xl mx-auto" id="main-content-rules">
                        <section id="s0">
                        <div class="info-card">
                        <h2 class="!mt-0" id="s0_heading"><span class="rule-number">§ 0</span>Golden Rules</h2>
                        <h3 class="mt-8" id="s0_1"><span class="rule-number">§ 0.1</span>Rule of the Highest Source</h3>
                        <p><strong>Only the single largest bonus and the single largest penalty of each type apply. Types are defined by their effect (e.g., "defense roll bonus", "income bonus"). All bonuses to defense rolls are considered the same type, regardless of their source (clan ability, castle, etc.). They do not stack.</strong><br><em class="text-sm text-gray-400 mt-2 block">Example 1: A defending Uesugi unit (+1 defense) in a province with a castle (+1 defense) receives only a single +1 bonus to its defense rolls, not +2.</em><br><em class="text-sm text-gray-400 mt-2 block">Example 2: A defending Hōjō unit in their Fortress (+2 defense) that is targeted by a Ninja's Sabotage (-1 defense) would resolve its defense rolls with a net +1 bonus. This confirms that bonuses and penalties apply concurrently.</em></p>
                        <h3 class="mt-8" id="s0_2"><span class="rule-number">§ 0.2</span>Module Rules Break Core Rules</h3>
                        <p><strong>The rule of an optional module always takes precedence over a core rule it directly contradicts.</strong></p>
                        <h3 class="mt-8" id="s0_3"><span class="rule-number">§ 0.3</span>Limited Components</h3>
                        <p>The number of game components (bushi, ronin, markers, etc.) is limited by the contents of the game. Once the general supply of a component is exhausted, no more of that type can be brought into play until some return to the supply.</p>
                        </div>
                        </section>
                        <hr class="section-divider">
                            <section id="s1">
                               <div class="info-card">
                               <h2 class="!mt-0" id="s1_heading"><span class="rule-number">§ 1</span>THE CORE GAME</h2>
                               <h3 class="mt-8" id="s1_1"><span class="rule-number">§ 1.1</span>The Goal of the War</h3>
                               <h4 class="mt-6" id="s1_1_1"><span class="rule-number">§ 1.1.1</span>Victory Conditions</h4>
                               <p>Victory is achieved by meeting one of two conditions:</p>
                               <ul class="list-disc list-inside">
                               <li>a) <strong>Province Control</strong> (see <a href="#s1_2" class="nav-link-inline">§1.2</a>)</li>
                               <li>b) <strong>The Shōgun's Mandate</strong> (see <a href="#s1_3" class="nav-link-inline">§1.3</a>)</li>
                               </ul>
                               <p><em>The game ends when a victory condition is met at the end of any phase.</em> In case of a simultaneous fulfillment, the priority is:</p>
                               <ol class="list-decimal list-inside ml-8">
                               <li>Shōgun's Mandate</li>
                               <li>Province Control</li>
                               <li>Path of Glory (Module, see <a href="#s10_4" class="nav-link-inline">§10.4</a>)</li>
                               </ol>
                               <h4 class="mt-6" id="s1_1_2"><span class="rule-number">§ 1.1.2</span>Timing of Victory Check</h4>
                               <p><strong>Victory conditions apply only at the end of each phase.</strong></p>
                               <h3 class="mt-8" id="s1_2"><span class="rule-number">§ 1.2</span>Victory by Province Control</h3>
                               <p>You win if you control a certain number of provinces:</p>
                               <ul class="list-disc list-inside">
                               <li><strong>4 Players:</strong> 20 provinces</li>
                               <li><strong>5 Players:</strong> 18 provinces</li>
                               </ul>
                               <h4 class="mt-6" id="s1_2_1"><span class="rule-number">§ 1.2.1</span>Tie-Breaker</h4>
                               <p>In the rare case of a tie, a clear winner is determined by the following sequence:</p>
                               <ol class="list-decimal list-inside space-y-1">
                               <li><strong>Economic Strength:</strong> The tied player with more <strong>Koku</strong> wins.</li>
                               <li><strong>Leadership Preservation:</strong> The player with the most <strong>Daimyō</strong> remaining wins.</li>
                               <li><strong>Strategic Prestige:</strong> The player who controls the most <strong>Mandate Provinces</strong> wins.</li>
                               <li><strong>Initiative:</strong> The player who would have acted <strong>earlier in the next round's turn order</strong> wins.</li>
                               </ol>
                               <h3 class="mt-8" id="s1_3"><span class="rule-number">§ 1.3</span>Alternative Victory: The Shōgun's Mandate</h3>
                               <p>You win if you have sole, undisputed control over the three Mandate Provinces at the end of any phase:</p>
                               <ul class="list-disc list-inside ml-8">
                               <li>Yamashiro (Kyoto)</li>
                               <li>Settsu (Osaka)</li>
                               <li>Sagami (Edo)</li>
                               </ul>
                               <p class="mt-4"><em>There must be no units from allies (see <a href="#s10_1" class="nav-link-inline">§10.1</a>) in these provinces for you to claim this victory.</em></p>
                               <p><em>Special Rule: When defending in Yamashiro (Kyoto), your units receive a +1 bonus to their defense rolls.</em></p>
                               </div>
                               </section>
                               <hr class="section-divider">
                               <section id="s2">
                                  <div class="info-card">
        <h2 class="!mt-0" id="s2_heading"><span class="rule-number">§ 2</span>Preparing for Battle</h2>
        <h3 class="mt-8" id="s2_1"><span class="rule-number">§ 2.1</span>Components</h3>
        <ul class="list-disc list-inside">
            <li><strong>Daimyō (3 per clan):</strong> Your irreplaceable leaders.</li>
            <li><strong>Bushi (69 per clan):</strong> The backbone of your clan.</li>
            <li><strong>Koku:</strong> The lifeblood of your clan, representing rice and resources.</li>
            <li><strong>Ronin (30 total):</strong> Masterless samurai for hire.</li>
            <li><strong>Castles (10 total):</strong> Fortifications for your provinces.</li>
            <li><strong>Ninja (1 total):</strong> A master of espionage.</li>
            <li><strong>Player Screens, Game Board, six-sided dice (d6), and various markers.</strong></li>
        </ul>
    </div>

    <div class="info-card">
        <h3 class="!mt-0" id="s2_2"><span class="rule-number">§ 2.2</span>The Eve of War: Clan Selection</h3>
        <p>To ensure a balanced and strategically engaging conflict, the great clans are selected through a draft. This guarantees a wide geographic distribution of power, preventing strategic isolation and fostering immediate interaction.</p>
        <div class="info-card mt-6 bg-gray-900 border-accent-secondary">
    <h5 class="!mt-0 !border-b-accent-secondary/50">Component Tip: Province Cards</h5>
    <p>The game includes 68 province cards. These are excellent for denoting province control during the game and are especially useful during the clan selection draft to see which provinces are tied to the remaining clans.</p>
</div>
        <h4 class="mt-6" id="s2_2_1"><span class="rule-number">§ 2.2.1</span>Define the Strategic Regions</h4>
        <p>The nine great clans are grouped into three strategic regions, reflecting their historical spheres of influence.</p>

<div class="table-responsive-wrapper">
    <table class="table-structured">
        <thead>
            <tr>
                <th data-label="West">The West</th>
                <th data-label="Center">The Center</th>
                <th data-label="East">The East</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td data-label="West">Mōri (Aki)<br>Otomo (Bungo)<br>Shimazu (Satsuma)</td>
                <td data-label="Center">Chosokabe (Tosa)<br>Oda (Owari)<br>Tokugawa (Mikawa)</td>
                <td data-label="East">Hōjō (Sagami)<br>Takeda (Kai)<br>Uesugi (Echigo)</td>
            </tr>
        </tbody>
    </table>
</div>

        <h4 class="mt-6" id="s2_2_2"><span class="rule-number">§ 2.2.2</span>Step-by-Step: The Draft Procedure</h4>
        <p>A draft is a simple way to choose factions to ensure a fair and interesting game. Instead of everyone grabbing their favorite clan at once, you will take turns picking one by one. This section breaks it down into simple steps.</p>
        
        <h5 class="mt-4" id="s2_2_2_1"><span class="rule-number">§ 2.2.2.1</span> Step 1: Determine the Pick Order</h5>
        <p>Determine a random starting order for the players (e.g., by rolling dice). The player who would act <strong>last</strong> in this random order gets to pick their clan <strong>first</strong>. The clan pick order is the reverse of the randomly determined player order.</p>

        <h5 class="mt-4" id="s2_2_2_2"><span class="rule-number">§ 2.2.2.2</span> Step 2: Make Your Picks (with one restriction)</h5>
        <p>Starting with the first player in the pick order, each player chooses one available clan. There is only one special rule for the first few picks:</p>
        <blockquote><strong>The Regional Restriction Rule:</strong> The first three players picking must each choose a clan from a different, unclaimed <strong>Strategic Region</strong> (West, Center, or East). Once all three regions have been chosen from, this restriction is lifted for any remaining players.</blockquote>
        <p>This ensures that the clans are spread out across the map, creating an interactive game from the very beginning.</p>
    </div>

<div class="info-card mt-4">
    <h5 class="!mt-0">Designer's Note on Initial Order</h5>

    <p><strong>Designer's Note on Initial Order</strong></p>

    <p>The game requires a random method to establish the initial draft order and the first round's turn order. This is necessary because:</p>

    <br> <!-- visible blank line -->

    <p>
        1. <strong>Before clan selection</strong>: Players have no clan names yet, so the alphabetical tie-breaker cannot apply to determine draft order.<br>
        2. <strong>After clan selection, before the first turn</strong>: All players have identical game states (1 province, 0 Koku, 4 units), making all Gekokujō tie-breakers ineffective.<br>
        3. <strong>After income in Round 1</strong>: All players still have identical counts (1 province, 4 Koku after income, 4 units), so the standard Gekokujō principle and its tie-breakers remain inapplicable.
    </p>

    <br> <!-- visible blank line -->

    <p>Therefore, a random determination of initial player order is required for both the draft phase and the first round of play. From Round 2 onwards, the Gekokujō principle functions normally as players' game states will have diverged.</p>
</div>
    <h4 class="mt-16" id="s2_2_3">Example Draft Walkthrough (4-Player Game)</h4>
    <p><em>Let's walk through an example with these steps.</em></p>
    <ol class="list-decimal list-inside space-y-2 mt-4">
        <li><strong>Determine Pick Order:</strong> The players roll dice to establish a random turn order. The result is: Player D → C → B → A. The clan draft pick order is the reverse of this: Player A → B → C → D.</li>
        <li><strong>Player A (picks 1st):</strong> Player A must pick a clan. They choose the Takeda from the East. The "East" region is now considered claimed for the initial picks.</li>
        <li><strong>Player B (picks 2nd):</strong> Player B must pick from an unclaimed region (West or Center). They select the Oda from the Center. The "Center" region is now claimed.</li>
        <li><strong>Player C (picks 3rd):</strong> Player C must pick from the last unclaimed region, the West. They choose the Shimazu. All three regions are now represented.</li>
        <li><strong>Player D (picks 4th):</strong> The Regional Restriction is now lifted. Player D can choose any of the remaining clans from any region.</li>
    </ol>
    <p class="mt-4">This draft system becomes a "meta-game" before the first turn. Your initial choice is not just about which clan ability you prefer; it also limits the options of your opponents and shapes the political landscape of the entire game.</p>
    
    <div class="info-card">
        <h3 class="!mt-0" id="s2_3"><span class="rule-number">§ 2.3</span>Initial Setup</h3>
        <ol class="list-decimal list-inside">
            <li><strong>Place Starting Units:</strong> Each player places three Daimyō and <strong>one</strong> Bushi in their clan's starting province.</li>
            <li><strong>First Turn Exception:</strong> On the first turn of the game only, players do not pay the Unit Maintenance cost.</li>
        </ol>
    </div>

    <h3 class="mt-16" id="s2_4"><span class="rule-number">§ 2.4</span>The Great Clans</h3>
    <blockquote>The clans are not fundamentally different, but their unique advantages reflect their historical strengths and strategic focus.</blockquote>
<div class="table-responsive-wrapper">
    <table class="table-structured">
        <thead>
            <tr>
                <th data-label="Clan">Clan</th>
                <th data-label="Province">Province</th>
                <th data-label="Ability">Ability</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td data-label="Clan"><strong>Chosokabe</strong></td>
                <td data-label="Province">Tosa</td>
                <td data-label="Ability">Your base income is 4 Koku (instead of 3). Additionally, you gain +1 Koku for every 2 coastal provinces you control (max +2 Koku per round).</td>
            </tr>
            <tr>
                <td data-label="Clan"><strong>Hōjō</strong></td>
                <td data-label="Province">Sagami</td>
                <td data-label="Ability">The cost to build your Fortress is 3 Koku. Its defense bonus is +2 (instead of +1). If your Fortress is destroyed, you may rebuild it in a later round for the same cost. Starts in a Mandate Province.</td>
            </tr>
            <tr>
                <td data-label="Clan"><strong>Mōri</strong></td>
                <td data-label="Province">Aki</td>
                <td data-label="Ability">Once per turn, you may spend 1 Koku to move a Mōri Daimyō and up to 5 Bushi in the same province to any Mōri-controlled coastal province along a sea line. You gain +1 Koku for every 3 coastal provinces you control.</td>
            </tr>
            <tr>
                <td data-label="Clan"><strong>Oda</strong></td>
                <td data-label="Province">Owari</td>
                <td data-label="Ability">If an Oda Daimyō is present, all attacking Oda units in that battle receive a +1 bonus to their attack rolls.</td>
            </tr>
            <tr>
                <td data-label="Clan"><strong>Otomo</strong></td>
                <td data-label="Province">Bungo</td>
                <td data-label="Ability">When you declare an attack, you may spend 2 Koku before any dice are rolled. If you do, you may re-roll all of your failed attack rolls for your Bushi units in that battle.</td>
            </tr>
            <tr>
                <td data-label="Clan"><strong>Shimazu</strong></td>
                <td data-label="Province">Satsuma</td>
                <td data-label="Ability">+1 Koku per coastal province you control (max +3 per round).</td>
            </tr>
            <tr>
                <td data-label="Clan"><strong>Takeda</strong></td>
                <td data-label="Province">Kai</td>
                <td data-label="Ability">When a Takeda Daimyō moves, up to 6 Bushi from the same starting province may move with him as a single group, using the Daimyō's movement of 3.</td>
            </tr>
            <tr>
                <td data-label="Clan"><strong>Tokugawa</strong></td>
                <td data-label="Province">Mikawa</td>
                <td data-label="Ability">Immune to Mountain Provisions costs in mountain provinces.</td>
            </tr>
            <tr>
                <td data-label="Clan"><strong>Uesugi</strong></td>
                <td data-label="Province">Echigo</td>
                <td data-label="Ability">Any Uesugi unit defending in a province under your control at the start of this round receives a +1 bonus to its defense rolls.</td>
            </tr>
        </tbody>
    </table>
</div>
</section>
<hr class="section-divider">
                            <section id="s3">
    <div class="info-card">
        <h2 class="!mt-0" id="s3_heading"><span class="rule-number">§ 3</span>The Round Structure</h2>
        <blockquote>Each round mirrors a year of feudal war. Spring Planning -> Summer Campaign -> Harsh Winter. Mastering this rhythm of Logistics -> Operations -> Attrition is the true path to becoming Shogun.</blockquote>

        <h3 class="mt-8" id="s3_1"><span class="rule-number">§ 3.1</span>Phase Overview</h3>
        <ol class="list-decimal list-inside">
            <li><strong>Phase 1a: Administration</strong> (Income, Unit Maintenance, Player Order)</li>
            <li><strong>Phase 1b: Reinforcement</strong> (Recruitment & Construction)</li>
            <li><strong>Phase 2: Campaign</strong> (Movement & Combat)</li>
            <li><strong>Phase 3: Winter</strong> (Mountain Provisions)</li>
        </ol>

        <h3 class="mt-8" id="s3_2"><span class="rule-number">§ 3.2</span>Unit Limit per Province (Stacking Limit)</h3>
        <p>A province can sustain a maximum of 7 units belonging to a single player.</p>
        <p class="mt-4"><strong>Governing Principle:</strong> This limit must be respected whenever a game step or effect that changes the number of units in a province is fully resolved. This applies regardless of whether the change was caused by a standard action (like Recruitment or Movement), a special ability, a card, or any other game mechanic.</p>
        <p class="mt-4"><strong>Exception: Pass-Through Movement:</strong> Units are permitted to move through a province that already contains 7 of their own units. The unit limit is checked only before a movement begins and after it is completed, but not during the movement itself.</p>
        </div>
</section>
<hr class="section-divider">
                 <section id="s4">
    <div class="info-card">
        <h2 class="!mt-0" id="s4_heading"><span class="rule-number">§ 4</span>Phase 1a: Administration</h2>
        <h3 class="mt-8" id="s4_1"><span class="rule-number">§ 4.1</span>Income, Unit Maintenance & Gekokujō (Sequential-Simultaneous)</h4>
        <p>Though these steps are completed by all players before moving on, they are resolved in a strict sequence to prevent timing conflicts:</p>
        <ol class="list-decimal list-inside">
            <li><strong>Collect Income:</strong> All players simultaneously gain 3 Koku base income + 1 Koku per controlled province.</li>
            <li><strong>Pay Unit Maintenance:</strong> All players simultaneously pay 1 Koku for every 2 Bushi units (rounded up). Daimyō are free. <em>(This is skipped on the first turn of the game).</em></li>
            <li><strong>Determine Player Order (Gekokujō):</strong> Only after all income and Unit Maintenance have been fully resolved, the player order for the round is determined. The player with the fewest provinces acts first. Ties are broken by: 1st - less Koku, 2nd - fewer total units, 3rd - clan name alphabetically.</li>
        </ol>
        <div class="info-card mt-6 bg-gray-900 border-accent-secondary">
    <h5 class="!mt-0 !border-b-accent-secondary/50">Best Practice: Tracking Player Order</h5>
    <p>For a clear and thematic way to track the current player order, consider using the plastic katana swords from the original 1986 edition of Shogun or similar tokens. At the start of the round, arrange them in the correct sequence. This provides an immediate, visual reference for all players.</p>
</div>
        <h3 class="mt-8" id="s4_2"><span class="rule-number">§ 4.2</span>Honor & Bankruptcy</h3>
        <p>A Daimyō is bound by their word and must meet their financial obligations. If a player is unable to pay a required cost (Unit Maintenance, Winter Mountain Provisions, etc.) at any time, they must immediately remove <strong>two</strong> of their Bushi units (player's choice) from the board for every 1 Koku they cannot pay. A clan cannot go into debt.</p>
        <p class="mt-4 italic">For example, if you are short 3 Koku, you must immediately remove 6 of your Bushi from the board.</p>
        
    </div>
</section>
<hr class="section-divider">
<section id="s5">
    <div class="info-card">

        <h2 class="!mt-0" id="s5_heading"><span class="rule-number">§ 5</span>Phase 1b: Reinforcement</h2>
        
        <h3 class="mt-8" id="s5_1"><span class="rule-number">§ 5.1</span>Recruitment & Construction (In Player Order)</h4>
        <ol class="list-decimal list-inside">
            <li><strong>Recruit:</strong> Pay 1 Koku per Bushi.</li>
            <li><strong>Hire Ninja:</strong> Pay 3 Koku, hire Ninja until end of turn (see <a href="#s9_1" class="nav-link-inline">§9.1</a>).</li>
            <li><strong>Castle & Fortress Construction:</strong> Spend Koku to build or fortify a castle (see <a href="#s9_2" class="nav-link-inline">§9.2</a>).</li>
        </ol>
        
        <h3 class="mt-8" id="s5_2"><span class="rule-number">§ 5.2</span>Unit Placement</h4>
        <p>All newly recruited units must be placed in a province that you controlled at the start of the Planning & Reinforcement phase.</p>

    </div>
</section>
<hr class="section-divider">
<section id="s6">
    <h2 class="!mt-0" id="s6_heading"><span class="rule-number">§ 6</span>Phase 2: Campaign</h2>
<p>After all players have completed their reinforcements, the Campaign phase begins, proceeding in the newly established player order. On your turn, you will first complete all movement with all your units. <strong>Only after all your movement is finished will you resolve any battles</strong> that resulted, one by one.</p>
    <div class="info-card">
        <h3 class="!mt-0" id="s6_1"><span class="rule-number">§ 6.1</span>&nbsp;Movement</h3>
        
        <h4 class="mt-6" id="s6_1_1"><span class="rule-number">§ 6.1.1</span>&nbsp;General Movement</h4>
        <p>A player may move any number of their units during their Movement Phase.</p>
        
        <h4 class="mt-6" id="s6_1_2"><span class="rule-number">§ 6.1.2</span>&nbsp;Group Movement: Splitting & Merging Armies</h4>
        <p>Units can conduct their movement independently. This allows for two fundamental maneuvers:</p>
        <ul class="list-disc list-inside ml-4">
            <li><strong>Splitting Armies:</strong> Multiple units starting their movement in the same province may move to different destination provinces.</li>
            <li><strong>Merging Armies:</strong> Multiple units starting their movement in different provinces may end their movement in the same destination province.</li>
        </ul>
        
        <h4 class="mt-6" id="s6_1_3"><span class="rule-number">§ 6.1.3</span>&nbsp;Movement Restrictions</h4>
        <p>All movement is subject to the following universal restrictions:</p>
        <ul class="list-disc list-inside ml-4">
            <li><strong>Movement Range:</strong> Bushi may move up to 2 provinces; Daimyō may move up to 3.</li>
            <li><strong>Entering Enemy Territory:</strong> A unit's or army's movement must end immediately upon entering a province containing an enemy player's units (unless an Honor Pact is in effect, see §10.1).</li>
            <li><strong>Stacking Limit:</strong> A province may not contain more than 7 of a single player's units at the end of their movement.</li>
        </ul>
        <div class="info-card mt-6 bg-gray-900 border-accent-secondary">
    <h5 class="!mt-0 !border-b-accent-secondary/50">Component Tip: Managing Large Armies</h5>
    <p>Should army sizes get too big for the province on the board, use off-board tactical tableaus to place your units. Stick the corresponding province card under each section of the tableau to clearly mark which army is in which province.</p>
</div>
    </div>

    <div class="info-card">
        <h3 class="!mt-0" id="s6_2"><span class="rule-number">§ 6.2</span>The Art of War: Combat</h3>
        <p>Combat occurs when units of different players are in the same province after the active player has completed all of their movement. The player whose turn it is is the attacker. All combat rolls are made using standard six-sided dice (d6).</p>
        <div class="info-card mt-6 bg-gray-900 border-accent-secondary">
    <h5 class="!mt-0 !border-b-accent-secondary/50">Best Practice: Speeding Up Combat</h5>
    <p>Instead of rolling consecutively for units with different hit profiles, use different colored dice for each unit type with a different hit profile (e.g., white for Bushi with 5-6, black for Daimyō with 4-6 ) and roll them simultaneously. This will speed up battle resolution considerably.</p>
</div>
        <h4 class="mt-6" id="s6_2_1"><span class="rule-number">§ 6.2.1</span>The Combat Sequence</h4>
        <ol class="list-disc list-inside">
            <li>(Optional) <strong>Hire Ronin:</strong> Attacker, then defender, may hire Ronin.</li>
            <li>(Optional) <strong>Ninja Assassination:</strong> Reveal Ninja if on a mission.</li>
            <li><strong>Determine Hits:</strong> All units from all sides roll dice simultaneously to determine the number of hits they score.</li>
            <li><strong>Assign & Remove Casualties:</strong> Starting with the attacker, each player assigns their hits to enemy units. After all hits are assigned, all marked units are removed from the board at the same time.</li>
            <li><strong>Check for Control:</strong> If units from only one side remain, that player controls the province. If units from more than one side remain, or no units remain, the province becomes neutral.</li>
            <li>(Module) <strong>Raiding:</strong> If using module §10.3, the new controller seizes any invested Koku (see §6.2.7).</li>
        </ol>
        
        <h4 class="mt-6" id="s6_2_2"><span class="rule-number">§ 6.2.2</span>Combat With 3+ Players</h4>
        <p>In a battle involving three or more players, all sides roll their dice simultaneously. Then, a player who has been attacked distributes their hits first. Finally, all players remove casualties at the same time.</p>
        
        <h4 class="mt-6" id="s6_2_3"><span class="rule-number">§ 6.2.3</span>Combat Rolls</h4>
        <!-- This entire div replaces the old one for the combat table in § 6.2.3 -->
<div class="table-responsive-wrapper">
    <table class="table-structured">
        <thead>
            <tr>
                <th data-label="Unit">Unit</th>
                <th data-label="Dice">Dice</th>
                <th data-label="Attack Hits">Attack Hits</th>
                <th data-label="Defense Hits">Defense Hits</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td data-label="Unit">Bushi</td>
                <td data-label="Dice">1d6</td>
                <td data-label="Attack Hits">5-6</td>
                <td data-label="Defense Hits">6</td>
            </tr>
            <tr>
                <td data-label="Unit">Daimyō</td>
                <td data-label="Dice">3d6</td>
                <td data-label="Attack Hits">4-6</td>
                <td data-label="Defense Hits">4-6</td>
            </tr>
            <tr>
                <td data-label="Unit">Ronin</td>
                <td data-label="Dice">1d6</td>
                <td data-label="Attack Hits">5-6</td>
                <td data-label="Defense Hits">6</td>
            </tr>
        </tbody>
    </table>
</div>
        <h4 class="mt-6" id="s6_2_4"><span class="rule-number">§ 6.2.4</span>Ronin: Mercenaries</h4>
        <ul class="list-disc list-inside">
            <li><strong>Hiring:</strong> Pay 1 Koku per Ronin to add them to a battle.</li>
            <li><strong>Combat Profile:</strong> Ronin act as Bushi in all respects during combat, rolling one die and hitting on a 5-6 when attacking or a 6 when defending. They are affected by all applicable combat modifiers.</li>
            <li><strong>Limit:</strong> You may not have more Ronin than your own Bushi in a battle.</li>
            <li><strong>Fleeting Loyalty:</strong> After combat, all Ronin are removed from the board.</li>
        </ul>
        
        <h4 class="mt-6" id="s6_2_5"><span class="rule-number">§ 6.2.5</span>Example of Basic Combat</h3>
        <p>The Tokugawa player attacks a neutral province with 3 Bushi. It is defended by 2 Ronin hired by another player. No other modifiers are in play.</p>
        <ul class="list-disc list-inside">
            <li><strong>Tokugawa (Attacking):</strong> Rolls 3 dice for their 3 Bushi. An attack hits on a 5-6. They roll a 1, 4, and 5. This is \*\*1 hit\*\*.</li>
            <li><strong>Ronin (Defending):</strong> Rolls 2 dice for the 2 Ronin. A defense hits on a 6. They roll a 2 and 6. This is \*\*1 hit\*\*.</li>
            <li><strong>Resolving:</strong> Each side scored 1 hit. The Tokugawa player removes one Bushi, and the Ronin player removes one Ronin. The Tokugawa player now has 2 Bushi in the province, and the Ronin player has 1. The province remains contested.</li>
        </ul>
        
        <h4 class="mt-6" id="s6_2_6"><span class="rule-number">§ 6.2.6</span>Example of Combat with Modifiers</h3>
        <h5 class="mt-4" id="s6_2_6_1"><span class="rule-number">§ 6.2.6.1</span>Calculating Target Numbers</h5>
        <ul class="list-disc list-inside">
            <li><strong>Oda (Attacking):</strong> Oda Daimyō is present, so clan ability applies (+1). Daimyō hits on 3-6, Bushi on 4-6.</li>
            <li><strong>Uesugi (Defending):</strong> Uesugi has +1 from clan ability and +1 from the castle. Per Golden Rule §0.1, only one +1 bonus applies. Bushi hit on 5-6.</li>
        </ul>
        <h5 class="mt-4" id="s6_2_6_2"><span class="rule-number">§ 6.2.6.2</span>Rolling Dice & Resolving</h4>
        <p>Oda rolls for 1 Daimyō (3 dice) and 3 Bushi (3 dice), getting 4 hits total. Uesugi rolls for 4 Bushi (4 dice), getting 2 hits. Uesugi removes all 4 of their Bushi. Oda removes 2 Bushi. Oda now controls Echigo.</p>
        
        <h4 class="mt-6 module-row" id="s6_2_7"><span class="rule-number">§ 6.2.7</span>Raiding Invested Provinces <span title="The Cycle of Rice and War Module" class="module-icon">🌾</span></h4>
        <p><em>This rule is only in effect when using \*\*The Cycle of Rice and War\*\* module (<a href="#s10_3" class="nav-link-inline">§10.3</a>).</em></p>
        <p>If an attacker gains control of a province that contains invested Koku tokens from the Sowing step, the attacker immediately seizes all Koku tokens from that province and adds them to their own treasury. This occurs at the end of combat, after all units have been removed and control is determined.</p>
        <h4 class="mt-6" id="s6_2_8"><span class="rule-number">§ 6.2.8</span>Consequences of Losing Control</h4>
        <p>If a player loses control of a province, all associated benefits and abilities for that province end immediately, unless a different timing is explicitly stated by another rule. This includes income potential for the next round, bonuses from clan abilities tied to that province, and control of Mandate Provinces.</p>
    </div>
</section>
<hr class="section-divider">
<section id="s7">
    <div class="info-card">

        <h2 class="!mt-0" id="s7_heading"><span class="rule-number">§ 7</span>Phase 3: Winter</h2>
        <p>After all players have completed their Campaign phase, the Winter phase occurs simultaneously for all players.</p>
        
        <h3 class="mt-8" id="s7_1"><span class="rule-number">§ 7.1</span>Pay Mountain Provisions Costs</h3>
        <p><strong>Pay 1 Koku for each mountain province you control, PLUS 1 Koku per 3 units (any type, rounded up) located across all those mountain provinces.</strong></p>
        <p class="mt-4 italic text-gray-400">● This rule is replaced by \*\*The Cycle of Rice and War\*\* module (<a href="#s10_3" class="nav-link-inline">§10.3</a>).<span title="The Cycle of Rice and War Module" class="module-icon ml-2">🌾</span></p>

    </div>
</section>
<hr class="section-divider">
// In script.js, replace the entire <section id="s8"> block with this:

<section id="s8">
    <div class="info-card">

        <h2 class="!mt-0" id="s8_heading"><span class="rule-number">§ 8</span>Victory & Defeat</h2>
        
        <h3 class="mt-8" id="s8_1"><span class="rule-number">§ 8.1</span>Vassalage</h3>
        <p>The instant your final Daimyō is removed, you become a vassal of the player who defeated it.</p>
        
        <h4 class="mt-6" id="s8_1_1"><span class="rule-number">§ 8.1.1</span>Consequences of Vassalage</h4>
<p>A player who becomes a vassal must immediately reduce their influence. This is resolved in the following, strict order:</p>

<ol class="list-decimal list-inside space-y-3 mt-4">
    <li>
        <strong>Choose Provinces:</strong> Choose half of your provinces (rounded down) that you must give up.
    </li>
    <li>
        <strong>Retreat Units:</strong> All of your units in the provinces you just gave up must immediately retreat to one or more adjacent provinces that you still control.
        <ul class="list-disc list-inside ml-6 mt-2 space-y-2">
            <li>
                <strong>Retreat Impossible:</strong> If a unit cannot perform a legal retreat (because no controlled, adjacent province is available), it is removed from the board.
            </li>
            <li>
                <strong>Unit Limit:</strong> The stacking limit of 7 units per province must be respected in the destination provinces after the retreat. Excess units that cannot be placed legally are also removed from the board.
            </li>
        </ul>
    </li>
    <li>
        <strong>Reduce Troops:</strong> Choose and remove half of your total remaining units from the board (rounded down).
    </li>
    <li>
        <strong>Control Loss:</strong> Provinces from which you removed your last unit in the previous step automatically become uncontrolled (neutral).
    </li>
</ol>

<p class="mt-6">Furthermore, the following general conditions apply to a vassal:</p>
<ul class="list-disc list-inside mt-2">
    <li>A vassal cannot win the game but retains their clan ability.</li>
    <li class="module-row">Upon becoming a Vassal, all existing Honor Pacts are immediately dissolved. A Vassal may not offer or accept new Honor Pacts until they are liberated.<span title="Political Play Module" class="module-icon ml-2">⚖️</span></li>
</ul>
        
        <h4 class="mt-6" id="s8_1_2"><span class="rule-number">§ 8.1.2</span>Paths to Liberation</h4>
        <p>Upon becoming a vassal, and at the start of each subsequent Planning Phase they remain a vassal, the player must choose one of the following two paths for that round.</p>

        <div class="info-card mt-4">
            <h5 class="!mt-0">Path 1: Gekokujō Assault ("The Low Overthrows the High")</h5>
            <p>This path represents a single, all-or-nothing military gambit to overthrow a master.</p>
            <p class="mt-2"><strong>Objective:</strong> To become a free clan again, the vassal must eliminate the last remaining Daimyō of any single free clan.</p>
            <p class="mt-2"><strong>Mechanic:</strong> Upon choosing this path during the Planning Phase, the vassal commits their entire treasury to the assault. For the remainder of the round, the vassal is affected as follows:</p>
            <ul class="list-disc list-inside ml-4 mt-2">
                <li>During the Combat Phase, they may hire Ronin in any battle at a favorable rate of 1 Koku for 2 Ronin units. Koku is spent from their treasury until it is depleted.</li>
            </ul>
            <p class="mt-2">Liberation is achieved the moment the objective is met. If the vassal fails to eliminate an opponent's last Daimyō by the end of the Winter Phase, they remain a vassal.</p>
            <p class="mt-2 text-sm text-gray-400"><em>Clarification: "Eliminate" means the Daimyō unit must be removed from the board as a result of a battle lost by its owner.</em></p>
        </div>

        <div class="info-card mt-4">
            <h5 class="!mt-0">Path 2: The Daimyō's Ransom (Rebuilding)</h5>
            <p>This path represents a gradual return to power through economic, strategic, and opportunistic means.</p>
            <p class="mt-2"><strong>Objective:</strong> To become a free clan again, the vassal must accumulate 10 Koku in their Liberation Fund.</p>
            <p class="mt-2"><strong>Mechanic:</strong> The Liberation Fund is a conceptual total; Koku committed to it are considered spent. A vassal adds Koku to the fund through three methods:</p>
            <ol class="list-decimal list-inside ml-4 mt-2 space-y-2">
                <li>
                    <strong>Annual Tithe (Economic Focus)</strong><br>
                    During the Administration Phase, after collecting income but before paying Unit Maintenance, the vassal may deposit up to 3 Koku from their treasury into the Liberation Fund.
                </li>
                <li>
                    <strong>Territorial Expansion (Strategic Growth)</strong><br>
                    During the Winter Phase, after resolving all battles, the vassal adds 2 Koku to the fund for each province they control in excess of the total number they controlled at the start of their vassalage.
                    <br><em class="text-sm text-gray-400">Clarification: If a vassal begins with 3 provinces, this bonus applies starting from the 4th province controlled. Controlling 5 provinces would grant a bonus of 4 Koku for that round.</em>
                </li>
                <li>
                    <strong>Daimyō's Bounty (Military Opportunism)</strong><br>
                    The vassal immediately adds 3 Koku to the fund each time one of their armies forces an opponent's Daimyō to retreat from a province as the result of a battle (i.e., is not removed as a casualty).
                    <br><em class="text-sm text-gray-400">Clarification: The bounty is awarded only for forcing a Daimyō to retreat by winning a battle and the Daimyō surviving. It is not awarded if the Daimyō is eliminated from the game.</em>
                </li>
            </ol>
        </div>
        
        <p class="mt-4 italic text-gray-400">★ This entire Vassalage system is replaced by the <strong>>Path of Glory</strong> module (<a href="#s10_4" class="nav-link-inline">§10.4</a>).<span title="Path of Glory Module" class="module-icon ml-2">🏆</span></p>
        
        <h3 class="mt-8" id="s8_2"><span class="rule-number">§ 8.2</span>Player Elimination</h3>
        <p>A player is eliminated if they lose their last province while having no Daimyō on the board.</p>
        <p class="mt-4">A player with zero provinces is not eliminated as long as they have at least one Daimyō on the board. On their turn, they continue to collect their base income of 3 Koku and may take actions as normal. This Daimyō exists in a contested, neutral province and must win a battle to reclaim territory—a difficult but not impossible path back into the conflict.</p>

    </div>
</section>
<hr class="section-divider">
                            <section id="s9">
    <div class="info-card">

        <h2 class="!mt-0" id="s9_heading"><span class="rule-number">§ 9</span>Advanced Rules</h2>
        
        <h3 class="mt-8" id="s9_1"><span class="rule-number">§ 9.1</span>The Ninja System</h3>
        <p>Hire the Ninja until end of this round for 3 Koku. Choose a public Field Operation or a covert Assassination. A Field Operation must be declared and its target province announced immediately after the Ninja is hired during your Reinforcement phase.</p>
        <div class="table-responsive-wrapper">
            <table>
                <thead><tr><th data-label="Type">Mission Type</th><th data-label="Sub-Type">Sub-Type</th><th data-label="Effect">Effect</th></tr></thead>
                <tbody>
                    <tr><td data-label="Type"><strong>Field Operation</strong></td><td data-label="Sub-Type">Sabotage</td><td data-label="Effect">-1 on defense rolls and no recruitment in target province for the round.</td></tr>
                    <tr><td data-label="Type"></td><td data-label="Sub-Type">Diversion</td><td data-label="Effect">The target province cannot be attacked for the round. This ability cannot target a Mandate Province if there is a player currently on the 'Path of Glory.'</td></tr>
                    <tr><td data-label="Type"><strong>Assassination</strong></td><td data-label="Sub-Type">Assassination</td><td data-label="Effect">At the start of a combat, you may reveal your hidden Ninja to remove one enemy Bushi from the battle. This ability cannot be used if the targeted Bushi is in the same province as one of its clan's Daimyō.</td></tr>
                </tbody>
            </table>
        </div>
        
        <h3 class="mt-8" id="s9_2"><span class="rule-number">§ 9.2</span>Castle & Fortress Construction</h3>
        <p> Any Clan can have only 1 Castle or Fortress on the game map simultaneously. </p>
        <ul class="list-disc list-inside">
            <li><strong>Build Castle (5 Koku):</strong> Place a castle in a province you control. Provides +1 on defense rolls. Limit 1 per player.</li>
            <li><strong>Fortify Castle (3 Koku):</strong> Place a marker on your castle. Increases its defense bonus to +2 for one round.</li>
            <li><strong>Destruction:</strong> If an enemy player gains control of a province containing a Castle or Fortress, the fortification is immediately removed from the board.</li>
        </ul>
        
    </div>
</section>
                `,
                'modules': `
                <section id="page-modules" class="page-container">
                    <div class="py-12 px-4"><div class="max-w-4xl mx-auto"><section id="s10_modules">
                        <header>
                           <h2 class="!mt-0" id="s10_heading"><span class="rule-number">§ 10</span>OPTIONAL MODULES</h2>
                        </header>
                        <div class="info-card border-accent-secondary bg-gray-900/50">
    <h3 class="!mt-0 !border-b-accent-secondary/50" id="s10_0">§ 10.0 Guide to Modularity: The Art of Coherence</h3>
    <p>The following modules are designed as precise instruments to accentuate specific aspects of the game. Combining them should be done with intent. This matrix serves as a guide to avoid incompatible configurations and to foster synergistic, thematically dense experiences.</p>


    <h4 class="mt-8">Matrix of Module Interactions</h4>
    <div class="table-responsive-wrapper mt-4">
        <table class="table-structured">
            <thead>
                <tr>
                    <th data-label="Module">Module</th>
                    <th data-label="Compatibility">Compatibility & Synergy</th>
                    <th data-label="Design Note">Design Note</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td data-label="Module"><strong>Political Play</strong> ⚖️</td>
                    <td data-label="Compatibility"><span class="font-bold text-green-400">✅ Synergizes with:</span> The Emperor's Favor 👑</td>
                    <td data-label="Design Note">Adds a thematic power factor to the mechanical alliance, focusing the game on political maneuvering.</td>
                </tr>
                <tr>
                    <td data-label="Module"><strong>Specialized Warfare</strong> 🛡️</td>
                    <td data-label="Compatibility"><span class="font-bold text-yellow-400">⚠️ High Complexity with:</span> The Cycle of Rice and War 🌾</td>
                    <td data-label="Design Note">Creates a deep logistical challenge. Serves as the base for the Firearm Revolution.</td>
                </tr>
                <tr>
                    <td data-label="Module"><strong>The Cycle of Rice and War</strong> 🌾</td>
                    <td data-label="Compatibility"><span class="font-bold text-green-400">✅ Synergizes with:</span> Ikkō-ikki Uprising 👺</td>
                    <td data-label="Design Note">Makes Sowing Koku a high-risk, high-reward decision, as a rebellion can destroy your provincial investment.</td>
                </tr>
                <tr>
                    <td data-label="Module"><strong>Path of Glory</strong> 🏆</td>
                    <td data-label="Compatibility"><span class="font-bold text-red-400">❌ Incompatible with:</span> The Emperor's Favor 👑</td>
                    <td data-label="Design Note">These modules offer conflicting "sudden death" victory conditions and should not be used together.</td>
                </tr>
                 <tr>
                    <td data-label="Module"><strong>Ikkō-ikki Uprising</strong> 👺</td>
                    <td data-label="Compatibility"><span class="font-bold text-green-400">✅ Synergizes with:</span> The Cycle of Rice and War 🌾</td>
                    <td data-label="Design Note">Introduces an internal threat that punishes turtling and makes territorial losses more dynamic.</td>
                </tr>
                <tr>
                    <td data-label="Module"><strong>The Nanban Trade</strong> 🔫</td>
                    <td data-label="Compatibility"><span class="font-bold text-blue-400">➡️ Requires:</span> Specialized Warfare 🛡️</td>
                    <td data-label="Design Note">Integrates directly into Specialized Warfare by unlocking the Arquebusier unit.</td>
                </tr>
                <tr>
                    <td data-label="Module"><strong>The Emperor's Favor</strong> 👑</td>
                    <td data-label="Compatibility"><span class="font-bold text-red-400">❌ Incompatible with:</span> Path of Glory 🏆<br><span class="font-bold text-green-400">✅ Synergizes with:</span> Political Play ⚖️</td>
                    <td data-label="Design Note">Elevates Kyoto to the single most important province, creating a political "king of the hill" objective.</td>
                </tr>
            </tbody>
        </table>
    </div>

    <h4 class="mt-8">Recommended Experience Packages</h4>
    <p>For a guaranteed coherent experience, the following thematically curated module packages are recommended:</p>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        <div class="info-card !m-0">
            <h5 class="!mt-0">The Age of Guns</h5>
            <p class="text-sm"><strong>Focus:</strong> Military & Technology</p>
            <p class="text-xs mt-2"><strong>Modules:</strong><br>§ 10.2 Specialized Warfare 🛡️<br>§ 10.6 The Nanban Trade 🔫</p>
            <p class="text-sm mt-2">A military conflict where control of trading ports and technological advancement create a strategic arms race. </p>
        </div>
        <div class="info-card !m-0">
            <h5 class="!mt-0">The Price of the Empire</h5>
            <p class="text-sm"><strong>Focus:</strong> Economy & Instability</p>
            <p class="text-xs mt-2"><strong>Modules:</strong><br>§ 10.3 The Cycle of Rice and War 🌾<br>§ 10.5 The Ikkō-ikki Uprising 👺</p>
            <p class="text-sm mt-2">A simulation of logistics and internal stability. War is decided in the rice paddies as much as on the battlefield.</p>
        </div>
        <div class="info-card !m-0">
            <h5 class="!mt-0">The Game for the Throne</h5>
            <p class="text-sm"><strong>Focus:</strong> Politics & Diplomacy</p>
            <p class="text-xs mt-2"><strong>Modules:</strong><br>§ 10.1 Political Play ⚖️<br>§ 10.7 The Emperor's Favor 👑</p>
            <p class="text-sm mt-2">Alliances help you take Kyoto, but a broken pact will spark a powerful and vengeful Blood Feud.</p>
        </div>
    </div>
</div>
 <div class="info-card">
    <h3 class="!mt-0" id="s10_1"><span class="rule-number">§ 10.1</span> Module: Political Play & Blood Feud<span title="Political Play & Blood Feud Module" class="module-icon ml-2">⚖️</span></h3>
    <blockquote><strong>Complexity Assessment:</strong> Rules: Medium | Depth: High | Playtime: Low<br><strong>In a Nutshell:</strong> Adds high-stakes alliances with lasting consequences for betrayal.</blockquote>

    <h4 class="mt-8" id="s10_1_1"><span class="rule-number">§ 10.1.1</span> The Honor Pact: Formation and Benefits</h4>
    <p>An Honor Pact is a formal alliance between two players for one or more rounds.</p>
    <p><strong>Timing:</strong> During Phase 1.3a is the Diplomacy Step right after the Recruitment & Construction phase, a player may propose a pact to another player. The offer costs the proposing player 1 Koku to the general supply.</p>
    <ul class="list-disc list-inside mt-4 space-y-2">
        <li><strong>Offer:</strong> The active player pays <strong>1 Koku</strong> to the general supply and proposes an Honor Pact to another player for the current round.</li>
        <li><strong>Acceptance & Pledge:</strong> If the other player accepts, <strong>both players must immediately place 2 Koku each</strong> as a pledge into a common pool. Each player may only be part of one Honor Pact at a time.

</li>
<p>A player who enters vassalage automatically leaves the Alliance. As that player did not attack the allied player, they do not suffer from the negative consequences of breaking a pact. Their pledge is returned to the general supply. Their ally gets their pledge returned.</p>
    </ul>

    <h4 class="mt-8" id="s10_1_2"><span class="rule-number">§ 10.1.2</span> Benefits of the Pact</h4>
    <ul class="list-disc list-inside">
        <li>Units of both players may move through each other's provinces.</li>
        <li>They may occupy the same province. However, the total number of units from all allied players in that single province cannot exceed 10. The individual limit of 7 units per player still applies.</li>
        <li>They cannot attack each other. An attack is considered an act of betrayal.</li>
    </ul>

    <h4 class="mt-8" id="s10_1_3"><span class="rule-number">§ 10.1.3</span> Breach of the Pact (Betrayal)</h4>
    <p>A pact is broken as soon as a player attacks their ally's province. The consequences are <strong>immediate and irrevocable</strong>:</p>
    <ul class="list-disc list-inside mt-4 space-y-2">
        <li><strong>Pledge Forfeiture & Compensation:</strong> The betrayer forfeits their claim to the pledge pool. The victim receives the <strong>entire pledge pool (4 Koku)</strong>.</li>
        <li><strong>Combat Malus:</strong> The betrayer suffers a <strong>-1 malus on all their attack rolls</strong> for the rest of the current round.</li>
        <li><strong>Blood Feud:</strong> The victim immediately and publicly declares a <strong>'Blood Feud'</strong> against their betrayer. This declaration is permanent and cannot be undone. For the remainder of the game, all units belonging to the victim receive a +1 bonus on attack and defense rolls when fighting that specific betrayer. Both players are responsible for remembering this lasting effect.</li>
    </ul>

    <h4 class="mt-8" id="s10_1_4"><span class="rule-number">§ 10.1.4</span> End of a Pact</h4>
    <p>All pacts are managed during the 1.3a Diplomacy Step. A pact persists until it is actively dissolved in this phase.</p>
    <p>Dissolution Process: Both partners declare their intent simultaneously and secretly.</p>
    <ul class="list-disc list-inside mt-4 space-y-2">
        <li><strong>Secret Choice:</strong> Both players take a Koku coin and secretly decide whether to keep it in their closed fist (Dissolve) or to have an empty fist (Continue).</li>
        <li><strong>Reveal:</strong> Both players reveal their hands simultaneously.
    </li>

    <p>Resolution & Consequences:</p>
    <ul class="list-disc list-inside mt-4 space-y-2">
        <li><strong>Empty Hand / Empty Hand:</strong> The pact continues.</li>
        <li><strong>Koku / Empty Hand:</strong> The pact is dissolved. The player with the Koku is the initiator.</li>
        <li><strong>Koku / Koku:</strong> The pact is dissolved. The Gekokujō tie-breaker (§ 4.1) determines the initiator (the loser of the tie-break).</li>
    </li>
    <p>In case of dissolution, the pledge is split (each player receives 2 Koku back). The player designated as the initiator must perform the Ordered Retreat: They must immediately move all their units from any jointly occupied provinces to an adjacent province they control. If no legal retreat is possible, the units remain, and the province becomes contested.</p>
</div>
<div class="info-card">
    <h3 class="!mt-0" id="s10_2"><span class="rule-number">§ 10.2</span>Module: Specialized Warfare<span title="Specialized Warfare Module" class="module-icon ml-2">🛡️</span></h3>
    <blockquote><strong>Complexity Assessment:</strong> Rules: High | Depth: High | Playtime: Medium<br><strong>In a Nutshell:</strong> Transforms combat into a tactical puzzle.</blockquote>
    <p><strong>Design Philosophy:</strong> This module changes the strategic question from "How large is my army?" to "What is the composition of my army?" It rewards reconnaissance, adaptation, and the creation of synergistic unit groups to counter specific enemy threats.</p>

    <div class="info-card border-accent-secondary bg-gray-900/50">
        <h4 class="!mt-0 !border-b-accent-secondary/50">The Central Dilemma: Combined Arms or Hard Counter?</h4>
        <p>This module forces a critical recruitment decision.</p>
        <ul class="list-none space-y-4 mt-4">
            <li class="flex">
                <span class="mr-4 text-accent-secondary font-bold text-xl">⚔️</span>
                <div><strong>COMBINED ARMS:</strong> Recruit a balanced force (e.g., spears and archers).<br><span class="text-sm text-gray-400">Benefit: Tactical flexibility; no crippling weakness. Risk: Master of none; can be overwhelmed by a specialized force.</span></div>
            </li>
            <li class="flex">
                <span class="mr-4 text-accent-secondary font-bold text-xl">🛡️</span>
                <div><strong>SPECIALIZED DOCTRINE:</strong> Recruit a homogenous force (e.g., all spearmen) to counter a specific threat.<br><span class="text-sm text-gray-400">Benefit: Dominant in its ideal situation. Risk: Highly vulnerable if caught in the wrong engagement.</span></div>
            </li>
        </ul>
    </div>

    <p class="mt-8">Replaces Bushi with specialized units. Adds a Ranged Phase before Melee.</p>
    <div class="table-responsive-wrapper">
        <table class="table-structured">
            <thead><tr><th data-label="Unit">Unit</th><th data-label="Attack">Attack (d6)</th><th data-label="Defense">Defense (d6)</th><th data-label="Special">Special</th></tr></thead>
            <tbody>
                <tr><td data-label="Unit"><strong>Ashigaru Spearmen</strong></td><td data-label="Attack">6</td><td data-label="Defense">5-6</td><td data-label="Special"><strong>Spear Wall:</strong> +1 defense if ≥2 are present.</td></tr>
                <tr><td data-label="Unit"><strong>Samurai Swordsmen</strong></td><td data-label="Attack">5-6</td><td data-label="Defense">5-6</td><td data-label="Special"><strong>Duelist:</strong> Rolls two dice if attacking alone.</td></tr>
                <tr><td data-label="Unit"><strong>Samurai Archers</strong></td><td data-label="Attack">4-6 (Ranged)</td><td data-label="Defense">6</td><td data-label="Special">Attacks in Ranged Phase only.</td></tr>
                <tr><td data-label="Unit"><strong>Samurai Bannermen</strong></td><td data-label="Attack">-</td><td data-label="Defense">6</td><td data-label="Special">Grants +1 movement to Ashigaru in the same province.</td></tr>
            </tbody>
        </table>
    </div>

    <h4 class="mt-8" id="s10_2_1"><span class="rule-number">§ 10.2.1</span>Expansion: Technological Change<span title="Specialized Warfare Module" class="module-icon ml-2">🛡️</span></h4>
    <p>Adds the "Ashigaru Arquebusiers" unit and a "Firearm Phase" before the Ranged Phase.</p>
    <div class="table-responsive-wrapper">
        <table class="table-structured">
            <thead><tr><th data-label="Unit">Unit</th><th data-label="Attack">Attack (d6)</th><th data-label="Defense">Defense (d6)</th><th data-label="Special">Special</th></tr></thead>
            <tbody>
                <tr><td data-label="Unit"><strong>Ashigaru Arquebusiers</strong></td><td data-label="Attack">4-6 (Firearm)</td><td data-label="Defense">-</td><td data-label="Special"><strong>Volley:</strong> Ignores castle defense bonus.</td></tr>
            </tbody>
        </table>
    </div>
</div>


<div class="info-card">
<h3 class="!mt-0" id="s10_3"><span class="rule-number">§ 10.3</span>Module: The Cycle of Rice and War<span title="The Cycle of Rice and War Module" class="module-icon ml-2">🌾</span></h3><blockquote><strong>Complexity Assessment:</strong> Rules: High | Depth: High | Playtime: Medium <strong>
<p>In a Nutshell:</strong> Introduces deep economic planning, risk, and raiding.</p></blockquote>
<p><strong>Design Philosophy:</strong> This module introduces a profound strategic trilemma by making your treasury vulnerable. In the core game, saving Koku is always a safe option. With this module, unmanaged wealth is lost to Spoilage. You must now actively choose how to protect your resources for the future.</p><div class="info-card border-accent-secondary bg-gray-900/50"><h4 class="!mt-0 !border-b-accent-secondary/50">The Central Dilemma: Spend, Sow, or Store?</h4><p>This module forces a critical decision at the end of the Planning phase. Any Koku not spent on your army must be allocated:</p><ul class="list-none space-y-4 mt-4"><li class="flex"><span class="mr-4 text-accent-secondary font-bold text-xl">⚔️</span><div><strong>SPEND:</strong> Use Koku for immediate military power (recruitment, castles).<span class="text-sm text-gray-400">Benefit: Maximum tempo. Risk: No future economic growth.</span></div></li><li class="flex"><span class="mr-4 text-accent-secondary font-bold text-xl">🌾</span><div><strong>SOW:</strong> Invest Koku on provinces for a high return.<span class="text-sm text-gray-400">Benefit: Highest potential reward. Risk: Vulnerable to Raiding and bad Harvests.</span></div></li><li class="flex"><span class="mr-4 text-accent-secondary font-bold text-xl">🏯</span><div><strong>STORE:</strong> Place Koku in your granaries, safe from Spoilage.<span class="text-sm text-gray-400">Benefit: Absolute security. Risk: Zero growth; the Koku is unavailable for the round.</span></div></li></ul></div><p class="mt-8"><strong>This module fundamentally alters the game's economy. It replaces the standard Winter phase (§7.1) and the standard Unit Maintenance step (§4.1, point 2). It also introduces the Raiding rule (§6.2.7) and modifies the core Income rule.</strong></p><h4 class="mt-8" id="s10_3_1"><span class="rule-number">§ 10.3.1</span>Definition of Koku States</h4><p>To manage the new economy, a player's Koku can exist in one of three distinct states:</p><ul class="list-disc list-inside space-y-2"><li><strong>Treasury:</strong> Koku held by the player behind their screen. This is the active currency used for recruitment, construction, and abilities. Koku in the Treasury is subject to Spoilage.</li><li><strong>Sown Koku:</strong> Koku physically placed on a province token as a public investment. It is vulnerable to Raiding but provides a return during the Harvest.</li><li><strong>Stored Koku:</strong> Koku set aside from the previous round's Allocation Step. It is safe from Spoilage and Raiding. It becomes part of the Treasury at the start of the next round's Planning Phase.</li></ul><h4 class="mt-8" id="s10_3_2"><span class="rule-number">§ 10.3.2</span>Modified Round Structure</h4><h5 class="mt-4">Phase 1: Planning & Reinforcement</h5><ol class="list-decimal list-inside space-y-3"><li><strong>Start of Phase:</strong> Any Stored Koku from the previous round is returned to the player's Treasury.</li><li><strong>Daimyō's Stipend (Replaces Standard Income):</strong> All players simultaneously collect a fixed stipend of 4 Koku and add it to their Treasury. Players do NOT collect additional Koku based on the number of provinces they control.</li><li><strong>Determine Player Order (Gekokujō):</strong> Player order for the round is determined as per the standard rules (§4.1, point 3).</li><li><strong>Reinforcement:</strong> In the established player order, players spend Koku from their Treasury to recruit units and build structures as per standard rules.</li><li><strong>Allocation (New Step):</strong> In player order, each player must allocate any and all Koku remaining in their Treasury. For each remaining Koku, a player must choose one of two options: <ul class="list-disc list-inside ml-4 mt-2"> <li><strong>Sow:</strong> Place Koku token on one of your controlled provinces. It is now Sown Koku.</li><li><strong>Store:</strong> Set the Koku aside. It is now Stored Koku and is safe until the next round.</li></ul><em>After this step, all player Treasuries must be empty.</em></li></ol><h5 class="mt-4">Phase 2: Campaign</h5><ul class="list-disc list-inside"><li>Standard movement and combat rules apply.</li><li><strong>Raiding (§6.2.7):</strong> If an attacker wins a battle and gains control of a province, they immediately take all Sown Koku tokens from that province's token and add them to their own Treasury. This raided Koku is subject to Spoilage at the end of the round.</li></ul><h5 class="mt-4">Phase 3: Winter (Replaces §7.1)</h5><ol class="list-decimal list-inside space-y-3"><li><strong>Harvest:</strong> One player rolls a single d6. The result determines the harvest yield for all players:<ul class="list-disc list-inside ml-4 mt-2"><li><strong>1-2 (Famine):</strong> Harvest yields 1 Koku for every 1 Koku Sown.</li><li><strong>3-5 (Normal):</strong> Harvest yields 2 Koku for every 1 Koku Sown.</li><li><strong>6 (Bountiful):</strong> Harvest yields 3 Koku for every 1 Koku Sown.</li></ul>Each player simultaneously receives the harvest yield for each Sown Koku on provinces they still control. This new Koku is added directly to their Treasury. The original Sown Koku tokens are returned to the general supply.</li><li><strong>Pay Costs (New Timing):</strong> All players simultaneously pay all Unit Maintenance (1 Koku per 2 Bushi) and Mountain Provisions costs from their Treasury.</li><li><strong>Spoilage:</strong> At the very end of the phase, each player must discard half (rounded down) of any Koku remaining in their Treasury. Koku that was designated as Stored Koku during the Allocation step is completely unaffected by this step.</li></ol>
        </li>
    </ul>
    
    <div class="info-card border-accent-secondary bg-gray-900">
        <h4 class="!mt-0">Warning: High Complexity Combination</h4>
        <p>Combining <strong>The Cycle of Rice and War</strong> <span title="The Cycle of Rice and War Module" class="module-icon">🌾</span> with <strong>Specialized Warfare</strong> <span title="Specialized Warfare Module" class="module-icon">🛡️</span> is recommended for expert players only. This pairing creates a deep, logistical wargame that requires managing both a complex economy and a granular combat system simultaneously.</p>
    </div>
</div>
<div class="info-card">
    <h3 class="!mt-0" id="s10_4"><span class="rule-number">§ 10.4</span>Module: Path of Glory<span title="Path of Glory Module" class="module-icon ml-2">🏆</span></h3>
    <blockquote><strong>Complexity Assessment:</strong> Rules: Low | Depth: Medium | Playtime: Minimal<br><strong>In a Nutshell:</strong> Adds a 'king-slayer' comeback victory.</blockquote>
    <p><strong>Design Philosophy:</strong> This module changes the strategic question for a defeated player from "How do I survive?" to "How can I forge a legend?" It embodies the ultimate Gekokujō spirit, reflecting historical figures like Toyotomi Hideyoshi who rose from nothing to rule Japan through sheer military genius.</p>
    
    <div class="info-card border-accent-secondary bg-gray-900/50">
        <h4 class="!mt-0 !border-b-accent-secondary/50">The Central Dilemma: Avenger or Warlord?</h4>
        <p>Once your Daimyō are defeated, you must choose your path to glory.</p>
        <ul class="list-none space-y-4 mt-4">
            <li class="flex">
                <span class="mr-4 text-accent-secondary font-bold text-xl">🗡️</span>
                <div><strong>THE AVENGER:</strong> Hunt the leaders of other clans to claim Glory Points.<br><span class="text-sm text-gray-400">Benefit: Fastest path to victory. Risk: Makes you a direct threat to all players.</span></div>
            </li>
            <li class="flex">
                <span class="mr-4 text-accent-secondary font-bold text-xl">🏯</span>
                <div><strong>THE WARLORD:</strong> Focus on seizing the lightly defended Mandate provinces.<br><span class="text-sm text-gray-400">Benefit: A massive, single-turn Glory Point swing. Risk: Requires a large army and makes your intentions obvious.</span></div>
            </li>
        </ul>
    </div>
    
    <p class="mt-8"><strong>Replaces the Vassalage rule (<a href="#s8_1" class="nav-link-inline">§8.1</a>).</strong> A player whose last Daimyō is defeated collects Glory Points (GP). Win at the end of the current phase upon reaching 7 GP.</p>
    <div class="table-responsive-wrapper">
        <table><thead><tr><th data-label="Condition">Condition</th><th data-label="GP">GP Earned</th></tr></thead><tbody><tr><td data-label="Condition">Defeat any player's last Daimyō.</td><td data-label="GP">+2 GP</td></tr><tr><td data-label="Condition">Defeat the leading player's last Daimyō.</td><td data-label="GP">+3 GP</td></tr><tr><td data-label="Condition">Gain sole control of a mandate province.</td><td data-label="GP">+3 GP</td></tr></tbody></table>
    </div>
</div>
<div class="info-card">
    <h3 class="!mt-0" id="s10_5"><span class="rule-number">§ 10.5</span>Module: The Ikkō-ikki Uprising<span title="The Ikkō-ikki Uprising Module" class="module-icon ml-2">👺</span></h3>
    <blockquote><strong>Complexity Assessment:</strong> Rules: Medium | Depth: High | Playtime: Medium<br><strong>In a Nutshell:</strong> Adds popular rebellions that can turn lost provinces into dangerous neutral strongholds.</blockquote>
    <p><strong>Design Philosophy:</strong> This module introduces a new internal threat. Losing a battle is no longer just a territorial loss; it can sow the seeds of a rebellion that makes reconquest difficult and costly, reflecting the historical peasant revolts that plagued many clans.</p>

    <h4 class="mt-8" id="s10_5_1"><span class="rule-number">§ 10.5.1</span>Unrest</h4>
    <p>Whenever a player loses a battle as the defender in one of their provinces, an "Unrest" marker is immediately placed in that province. A Bushi from the player's supply, laid on its side, is used as the Unrest marker.</p>

    <h4 class="mt-8" id="s10_5_2"><span class="rule-number">§ 10.5.2</span>Rebellion</h4>
    <p>If a province with one Unrest marker receives a second, it rebels. The following happens immediately:</p>
    <ul class="list-disc list-inside">
        <li>All the Bushi of all present players and both Unrest markers are removed.</li>
        <li>If a Bushi's owner's Daimyō is present, they must retreat to an adjacent, friendly province. If no retreat is possible, the Daimyō is removed from the game.</li>
        <li>Place 3 neutral Bushi in the province, which is now a neutral "Ikkō-ikki Stronghold"</li>
    </ul>

    <h4 class="mt-8" id="s10_5_3"><span class="rule-number">§ 10.5.3</span>Pacification & Reconquest</h4>
    <ul class="list-disc list-inside">
        <li><strong>Administrative Pacification:</strong> During the Reinforcement Phase, you may spend 2 Koku to remove one Unrest marker from a province you control.</li>
        <li><strong>Military Reconquest:</strong> An Ikkō-ikki Stronghold can be attacked by any player. To gain control, you must win the battle and then succeed at a "Pacification Test" by rolling a 4, 5, or 6 on a D6. On a failure, your attacking Bushi must retreat.</li>
    </ul>
</div>
<div class="info-card">
    <h3 class="!mt-0" id="s10_6"><span class="rule-number">§ 10.6</span>Module: The Nanban Trade & The Firearm Revolution <span title="The Nanban Trade & The Firearm Revolution Module" class="module-icon ml-2">🔫</span><span title="Specialized Warfare Module" class="module-icon ml-2">🛡️</span></h3>
    <blockquote><strong>Complexity Assessment:</strong> Rules: Medium | Depth: High | Playtime: Medium<br><strong>In a Nutshell:</strong> Unlocks powerful but expensive gunpowder units.</blockquote>
    <p><strong>Design Philosophy:</strong> This module represents the arrival of Portuguese traders and the revolutionary impact of firearms on Sengoku warfare. It creates a strategic race to control key trading ports and transforms military doctrine for players who can afford the technology.</p>

    <div class="info-card !mt-6 border-accent-primary bg-gray-900/50">
        <p class="!mt-0 font-bold">IMPORTANT: This module requires the <a href="#s10_2" class="nav-link-inline">Specialized Warfare module (§10.2)</a> to be active, as it adds the Ashigaru Arquebusiers unit type.</p>
    </div>

    <h4 class="mt-8" id="s10_6_1"><span class="rule-number">§ 10.6.1</span>Trading Posts</h4>
    <p>The provinces of Settsu and Hizen are designated as "Nanban Trading Posts."</p>

    <h4 class="mt-8" id="s10_6_2"><span class="rule-number">§ 10.6.2</span>Acquiring Firearm Technology</h4>
    <p>A player who has sole control of at least one Trading Post at the start of the Reinforcement Phase (Phase 1b) may pay a one-time cost of 8 Koku to permanently acquire "Firearm Technology." Firearm Technology can only be acquired ONCE per player.</p>
    <p>Upon acquiring this technology:</p>
    <ol class="list-decimal list-inside ml-4 mt-2">
        <li>Immediately place 3 Ashigaru Arquebusiers in the Trading Post province.</li>
        <li>Mark your clan with a permanent "Firearm Technology" token.</li>
    </ol>

    <h4 class="mt-8" id="s10_6_3"><span class="rule-number">§ 10.6.3</span>Recruiting Arquebusiers</h4>
    <p>A player with Firearm Technology may recruit Ashigaru Arquebusiers during the Reinforcement Phase for <strong>2 Koku per unit</strong>.</p>
    <p>Ashigaru Arquebusiers have the following combat profile:</p>
    <ul class="list-disc list-inside ml-4 mt-2">
        <li><strong>Attack:</strong> 4-6 (rolled during the Firearm Phase, which occurs BEFORE the Ranged Phase)</li>
        <li><strong>Defense:</strong> - (Arquebusiers do not roll defense dice)</li>
        <li><strong>Special Ability: Volley</strong> - Attacks ignore castle and fortress defense bonuses</li>
    </ul>

    <h4 class="mt-8" id="s10_6_4"><span class="rule-number">§ 10.6.4</span>Strategic Considerations</h4>
    <p>The high initial cost (8 Koku) and double recruitment cost (2 Koku/unit) make this technology a significant investment. However, the ability to ignore defensive fortifications and strike before other ranged units makes Arquebusiers a decisive force in siege warfare.</p>
    <p class="mt-2 text-sm italic text-gray-400"><strong>Recommended Strategy:</strong> Combine Arquebusiers with cheap Ashigaru Spearmen to create a cost-effective "combined arms" force where gunners break fortifications and spearmen hold the line.</p>
</div>
<div class="info-card">
    <h3 class="!mt-0" id="s10_7"><span class="rule-number">§ 10.7</span>Module: The Emperor's Favor<span title="The Emperor's Favor Module" class="module-icon ml-2">👑</span></h3>
    <blockquote><strong>Complexity Assessment:</strong> Rules: Low | Depth: High | Playtime: Medium<br><strong>In a Nutshell:</strong> Adds a new resource, "Legitimacy," and an alternative victory condition tied to controlling Kyoto.</blockquote>
    <p><strong>Design Philosophy:</strong> This module elevates the strategic importance of the Imperial Capital. It models the political legitimacy granted by the Emperor, creating a new currency—Legitimacy—that can be spent on powerful edicts or accumulated to achieve a decisive political victory, forcing players to fight for prestige as well as territory.</p>

    <h4 class="mt-8" id="s10_7_1"><span class="rule-number">§ 10.7.1</span>Gaining Legitimacy</h4>
    <p>To gain 1 Legitimacy Point, a player must have sole control of Yamashiro (Kyoto) at the start of the Reinforcement Phase. 'Sole control' means the province is occupied only by that player's units. The presence of any allied or enemy units prevents the gain of Legitimacy. Legitimacy is tracked openly with Koku coins from the general supply or any other countable item at hand.</p>

    <h4 class="mt-8" id="s10_7_2"><span class="rule-number">§ 10.7.2</span>Issuing Imperial Edicts</h4>
    <p>During your own turn in the campaign phase, before movement, you may spend Legitimacy on one of the following:</p>
    <ul class="list-disc list-inside">
        <li><strong>3 Legitimacy (Legitimate Claim):</strong> Remove up to 3 enemy Bushi from any one province that does not contain their Daimyō. Their owner(s) receive(s) 1 Koku from the general supply per Bushi removed this way.</li>
        <li><strong>3 Legitimacy (Imperial Censure):</strong> Choose one other player. For the remainder of the game round, any player who initiates an attack against the censured player receives a +1 bonus to their attack rolls for that battle.</li>
        <li><strong>6 Legitimacy (Appointed Shogun):</strong> If you control Kyoto at the start of your turn and have 6 or more Legitimacy, you immediately win the game. This victory condition overrides all others from the core rulebook.</li>
    </ul>

</div>
                </section>
                `,
                'strategy': `
                <section id="page-strategy" class="page-container">
                    <div class="py-12 px-4"><div class="max-w-4xl mx-auto">
<header class="page-header">
    <div class="header-content">
        <h1>Strategy</h1>
        <p class="subtitle">From Clan Tactics to Ancient Wisdom</p>
    </div>
</header>

<!-- DIDACTIC FUNNEL PART 1: THE FOUNDATION -->
<section id="s8_clans_guide" class="page-section">
    <h2>The Foundation: A Commander's Guide to the Great Clans</h2>
    <p class="text-gray-400 mb-6">Your journey begins here. Mastering a clan requires understanding its unique strengths, inherent weaknesses, and strategic objectives. Know your tools before you draw your sword.</p>

    <div class="space-y-6">

        <!-- Chosokabe -->
        <details class="bg-gray-800 p-4 rounded-lg">
            <summary class="cursor-pointer font-semibold">The Chosokabe Clan (Economist)</summary>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2">
                    <h4 class="!mt-0 !border-b-0">How to Play the Chosokabe</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Compound Your Income:</strong> Secure two coastal provinces early to max out your ability. This income advantage is your primary weapon.</li>
                        <li><strong>Build Tall:</strong> Use your superior income to build a Castle and recruit larger armies, playing defensively while your economy snowballs.</li>
                        <li><strong>Overwhelm with Numbers:</strong> In the mid-to-late game, field large armies that other clans cannot afford to maintain.</li>
                    </ul>
                    <h4 class="mt-6">How to Counter the Chosokabe</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Attack Early:</strong> An aggressive early attack can cripple them before their economy is fully developed.</li>
                        <li><strong>Disrupt their Coast:</strong> Seizing one of their key coastal territories slows their economic engine.</li>
                    </ul>
                </div>
                <div>
                    <h4 class="!mt-0 !border-b-0">Starting Province</h4>
                    <div class="text-center p-2 rounded-lg bg-gray-900">
                        <img src="images/provinces/tosa-600.jpg" alt="Map showing Tosa province" class="w-full h-auto rounded-md">
                        <p class="text-xs text-gray-400 mt-2">Start: Tosa. Secure your home island of Shikoku before expanding north.</p>
                    </div>
                </div>
            </div>
        </details>

        <!-- Hōjō -->
        <details class="bg-gray-800 p-4 rounded-lg">
            <summary class="cursor-pointer font-semibold">The Hōjō Clan (Builder)</summary>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2">
                    <h4 class="!mt-0 !border-b-0">How to Play the Hōjō</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Build the Fortress Early:</strong> Your Fortress in Sagami is a primary objective and an unbreakable anchor for your territories.</li>
                        <li><strong>Control the Center:</strong> Your home is a Mandate Province. Secure your fortress, then use it as a base to attack Kyoto and Osaka.</li>
                    </ul>
                    <h4 class="mt-6">How to Counter the Hōjō</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Ignore the Fortress:</strong> Do not attack their fortress. The +2 defense bonus is a trap. Conquer other provinces to win.</li>
                        <li><strong>Isolate and Contain:</strong> Capture the provinces around their fortress to limit their income and expansion.</li>
                    </ul>
                </div>
                <div>
                    <h4 class="!mt-0 !border-b-0">Starting Province</h4>
                    <div class="text-center p-2 rounded-lg bg-gray-900">
                        <img src="images/provinces/sagami-600.jpg" alt="Map showing Sagami province" class="w-full h-auto rounded-md">
                        <p class="text-xs text-gray-400 mt-2">Start: Sagami. Your fortress here is the key to a Mandate Victory.</p>
                    </div>
                </div>
            </div>
        </details>

        <!-- Mōri -->
        <details class="bg-gray-800 p-4 rounded-lg">
            <summary class="cursor-pointer font-semibold">The Mōri Clan (Naval Power)</summary>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2">
                    <h4 class="!mt-0 !border-b-0">How to Play the Mōri</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Establish a Coastal Network:</strong> Your primary goal is to control a string of coastal provinces for your economy and redeployment ability.</li>
                        <li><strong>Strategic Redeployment:</strong> Your greatest strength is surprise. For 1 Koku, you can shift a significant force across the map to an undefended flank.</li>
                    </ul>
                    <h4 class="mt-6">How to Counter the Mōri</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Break the Chain:</strong> Capturing a single key coastal province can sever their sea connection, nullifying their greatest advantage.</li>
                        <li><strong>Anticipate the Target:</strong> Do not leave your key coastal economic centers undefended.</li>
                    </ul>
                </div>
                <div>
                    <h4 class="!mt-0 !border-b-0">Starting Province</h4>
                    <div class="text-center p-2 rounded-lg bg-gray-900">
                         <img src="images/provinces/aki-600.jpg" alt="Map showing Aki province" class="w-full h-auto rounded-md">
                        <p class="text-xs text-gray-400 mt-2">Start: Aki. Use it to dominate the inland sea and project power east and west.</p>
                    </div>
                </div>
            </div>
        </details>

        <!-- Oda -->
        <details class="bg-gray-800 p-4 rounded-lg">
            <summary class="cursor-pointer font-semibold">The Oda Clan (Aggressor)</summary>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2">
                    <h4 class="!mt-0 !border-b-0">How to Play the Oda</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Utilise Daimyō in Combat:</strong> Your Daimyō are military assets. Use them in important assaults to gain the +1 attack bonus.</li>
                        <li><strong>Early Military Action:</strong> You have no economic bonuses. Attack a neighbor early to acquire provinces before their economy develops.</li>
                    </ul>
                    <h4 class="mt-6">How to Counter the Oda</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Target the Daimyō:</strong> Without a Daimyō present, their ability does not apply. Use a Ninja or a feint to isolate their leader.</li>
                        <li><strong>Avoid Decisive Battles:</strong> They benefit from large battles where their bonus shines. Employ smaller attacks and force them to spread out.</li>
                    </ul>
                </div>
                <div>
                    <h4 class="!mt-0 !border-b-0">Starting Province</h4>
                    <div class="text-center p-2 rounded-lg bg-gray-900">
                        <img src="images/provinces/owari-600.jpg" alt="Map showing Owari province" class="w-full h-auto rounded-md">
                        <p class="text-xs text-gray-400 mt-2">Start: Owari. Your central position is perfect for a swift strike towards Kyoto.</p>
                    </div>
                </div>
            </div>
        </details>

        <!-- Otomo -->
        <details class="bg-gray-800 p-4 rounded-lg">
            <summary class="cursor-pointer font-semibold">The Otomo Clan (Gambler)</summary>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2">
                    <h4 class="!mt-0 !border-b-0">How to Play the Otomo</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Conserve Koku:</strong> Your ability is expensive. Play conservatively, build your treasury, and save it for a single, game-changing battle.</li>
                        <li><strong>The Decisive Battle:</strong> Use your ability when attacking a high-value target (a Mandate Province, an enemy Daimyō) where the odds are otherwise unfavorable.</li>
                    </ul>
                    <h4 class="mt-6">How to Counter the Otomo</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Drain their Treasury:</strong> Force them into small, insignificant battles to bait them into spending their Koku.</li>
                        <li><strong>Force them to Defend:</strong> Their ability only works when attacking. If you can force the Otomo to be the defender, their ability is useless.</li>
                    </ul>
                </div>
                <div>
                    <h4 class="!mt-0 !border-b-0">Starting Province</h4>
                    <div class="text-center p-2 rounded-lg bg-gray-900">
                        <img src="images/provinces/bungo-600.jpg" alt="Map showing Bungo province" class="w-full h-auto rounded-md">
                        <p class="text-xs text-gray-400 mt-2">Start: Bungo. Consolidate your power on Kyushu before launching a decisive, well-funded invasion.</p>
                    </div>
                </div>
            </div>
        </details>

        <!-- Shimazu -->
        <details class="bg-gray-800 p-4 rounded-lg">
            <summary class="cursor-pointer font-semibold">The Shimazu Clan (Expansionist)</summary>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2">
                    <h4 class="!mt-0 !border-b-0">How to Play the Shimazu</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Dominate the Coast:</strong> Your first goal is to capture three coastal provinces to max out your ability and gain a Koku advantage.</li>
                        <li><strong>Create a Snowball Effect:</strong> Reinvest your extra income immediately into more Bushi to leverage your economic advantage into a military one.</li>
                    </ul>
                    <h4 class="mt-6">How to Counter the Shimazu</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Deny the Coast:</strong> Contest coastal provinces early to slow their economic engine.</li>
                        <li><strong>Outlast Them:</strong> Their bonus caps at +3. A clan with a stronger late-game ability can often weather the initial expansion and overpower them later.</li>
                    </ul>
                </div>
                <div>
                    <h4 class="!mt-0 !border-b-0">Starting Province</h4>
                    <div class="text-center p-2 rounded-lg bg-gray-900">
                        <img src="images/provinces/satsuma-600.jpg" alt="Map showing Satsuma province" class="w-full h-auto rounded-md">
                        <p class="text-xs text-gray-400 mt-2">Start: Satsuma. Your corner position is secure; expand rapidly along the coast to fuel your economy.</p>
                    </div>
                </div>
            </div>
        </details>

        <!-- Takeda -->
        <details class="bg-gray-800 p-4 rounded-lg">
            <summary class="cursor-pointer font-semibold">The Takeda Clan (Mobile Force)</summary>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2">
                    <h4 class="!mt-0 !border-b-0">How to Play the Takeda</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Threaten Multiple Fronts:</strong> Use your speed to position your main army in a central location from which it can strike in multiple directions.</li>
                        <li><strong>The Decisive Strike:</strong> Assemble a strong force under one Daimyō and use its 3-province movement to bypass enemy screens and attack a critical target.</li>
                    </ul>
                    <h4 class="mt-6">How to Counter the Takeda</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Screen and Block:</strong> Use single Bushi units to create a screen. Their army must stop upon entering an enemy province, preventing a deep strike.</li>
                        <li><strong>Counter-Attack the Homeland:</strong> Their power is often concentrated in one army. When it goes on campaign, their home can be left vulnerable.</li>
                    </ul>
                </div>
                <div>
                    <h4 class="!mt-0 !border-b-0">Starting Province</h4>
                    <div class="text-center p-2 rounded-lg bg-gray-900">
                        <img src="images/provinces/kai-600.jpg" alt="Map showing Kai province" class="w-full h-auto rounded-md">
                        <p class="text-xs text-gray-400 mt-2">Start: Kai. Your mobile cavalry is a threat to every clan in the center of Japan.</p>
                    </div>
                </div>
            </div>
        </details>

        <!-- Tokugawa -->
        <details class="bg-gray-800 p-4 rounded-lg">
            <summary class="cursor-pointer font-semibold">The Tokugawa Clan (Turtle)</summary>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2">
                    <h4 class="!mt-0 !border-b-0">How to Play the Tokugawa</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Secure the Highlands:</strong> Occupy mountain provinces to create a defensive core that is a logistical nightmare for your enemies, especially in Winter.</li>
                        <li><strong>Focus on the Late Game:</strong> Build a strong economy and army. The goal is to be in a superior position in the late game when others are overextended.</li>
                    </ul>
                    <h4 class="mt-6">How to Counter the Tokugawa</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Deny Mountain Access:</strong> Contest mountain provinces early to slow their economic development.</li>
                        <li><strong>Expand Elsewhere:</strong> Avoid costly attacks against their fortified mountain positions. Expand across the coastal and central plains instead.</li>
                    </ul>
                </div>
                <div>
                    <h4 class="!mt-0 !border-b-0">Starting Province</h4>
                    <div class="text-center p-2 rounded-lg bg-gray-900">
                        <img src="images/provinces/mikawa-600.jpg" alt="Map showing Mikawa province" class="w-full h-auto rounded-md">
                        <p class="text-xs text-gray-400 mt-2">Start: Mikawa. Be patient. Let your neighbors weaken each other, then emerge from your stronghold.</p>
                    </div>
                </div>
            </div>
        </details>

        <!-- Uesugi -->
        <details class="bg-gray-800 p-4 rounded-lg">
            <summary class="cursor-pointer font-semibold">The Uesugi Clan (Defender)</summary>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2">
                    <h4 class="!mt-0 !border-b-0">How to Play the Uesugi</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Establish a Defensive Front:</strong> Your ability makes every province a fortress. Secure key chokepoints and let the enemy break upon your walls.</li>
                        <li><strong>Calculated Offense:</strong> Conquer a province, hold it for a round to activate your bonus, and then use that secure base to launch your next strike.</li>
                    </ul>
                    <h4 class="mt-6">How to Counter the Uesugi</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Avoid Attacking Their Strength:</strong> Force them to attack you, as their ability is useless on offense.</li>
                        <li><strong>Exploit Tempo:</strong> Counter-attack a province they just conquered *this round* to deny them their defensive bonus.</li>
                    </ul>
                </div>
                <div>
                    <h4 class="!mt-0 !border-b-0">Starting Province</h4>
                    <div class="text-center p-2 rounded-lg bg-gray-900">
                        <img src="images/provinces/echigo-600.jpg" alt="Map showing Echigo province" class="w-full h-auto rounded-md">
                        <p class="text-xs text-gray-400 mt-2">Start: Echigo. Let your rivals exhaust their armies against your impregnable domain.</p>
                    </div>
                </div>
            </div>
        </details>
    </div>
</section>

<!-- DIDACTIC FUNNEL PART 2: THE LIBRARY -->
<section id="s8_war_college" class="page-section">
    <h2>The Library: Master the Classics</h2>
    <p class="text-gray-400 mb-6">The strategic situations in Gekokujō are not new. For centuries, commanders have faced the same dilemmas. Study these classical texts to deepen your understanding of the art of war.</p>

    <details class="bg-gray-800 p-4 rounded-lg mt-4">
        <summary class="cursor-pointer font-semibold text-xl">Sun Tzu's Art of War: Selected Aphorisms</summary>
        <div class="mt-6">
            <p class="mb-6 text-gray-400">Sun Tzu's "The Art of War," an ancient Chinese military treatise from the 5th century BC, remains the single most influential work of military strategy. Its principles are as relevant to Gekokujō as they were to ancient China.</p>
            <div class="space-y-4">
                <blockquote class="border-l-4 border-accent-secondary pl-4 italic">"The supreme art of war is to subdue the enemy without fighting."</blockquote>
                <blockquote class="border-l-4 border-accent-secondary pl-4 italic">"All warfare is based on deception."</blockquote>
                <blockquote class="border-l-4 border-accent-secondary pl-4 italic">"He will win who knows when to fight and when not to fight."</blockquote>
                <blockquote class="border-l-4 border-accent-secondary pl-4 italic">"In the midst of chaos, there is also opportunity."</blockquote>
                <blockquote class="border-l-4 border-accent-secondary pl-4 italic">"If you know the enemy and know yourself, you need not fear the result of a hundred battles."</blockquote>
            </div>
        </div>
    </details>

    <details class="bg-gray-800 p-4 rounded-lg mt-4">
        <summary class="cursor-pointer font-semibold text-xl">The Thirty-Six Stratagems</summary>
        <div class="mt-6">
            <p class="mb-6 text-gray-400">A collection of Chinese proverbs illustrating cunning strategies, often employing deception and psychological warfare. They offer a masterclass in asymmetrical thinking.</p>
            <div class="space-y-8">
                <div>
                    <h4 class="!mt-0 !border-b-gray-700 text-lg">I. Winning Stratagems</h4>
                    <div class="space-y-4 mt-4">
                        <p id="stratagem-1"><strong>1. Deceive the Heavens to Cross the Sea:</strong> Mask your true goal behind a mundane, overt operation.</p>
                        <p id="stratagem-2"><strong>2. Besiege Wèi to Rescue Zhào:</strong> Attack something of value to your enemy to force them to relieve your own threatened forces.</p>
                        <p id="stratagem-3"><strong>3. Kill with a Borrowed Sword:</strong> Use the strength of a third party to attack your enemy.</p>
                        <p id="stratagem-4"><strong>4. Await the Exhausted Enemy at Your Ease:</strong> Conserve your energy while encouraging your enemy to expend theirs.</p>
                        <p id="stratagem-5"><strong>5. Loot a Burning House:</strong> Capitalize on an enemy's internal chaos or crisis to advance your own interests.</p>
                        <p id="stratagem-6"><strong>6. Make a Sound in the East, Then Strike in the West:</strong> Use a feint to focus the enemy's attention on one location, then attack a different point.</p>
                    </div>
                </div>
                 <div>
                    <h4 class="!mt-8 !border-b-gray-700 text-lg">II. Enemy-Dealing Stratagems</h4>
                    <div class="space-y-4 mt-4">
                        <p id="stratagem-7"><strong>7. Create Something from Nothing:</strong> Use deception to make an audience believe in something that doesn't exist.</p>
                        <p id="stratagem-8"><strong>8. Openly Repair Roads, Secretly Advance to Chencang:</strong> Deceive with an obvious, slow approach, while secretly taking a faster route.</p>
                        <p id="stratagem-9"><strong>9. Watch the Fires Burning Across the River:</strong> Delay entering a conflict while other parties exhaust themselves. Step in to claim the prize when they are weakened.</p>
                        <p id="stratagem-10"><strong>10. Hide a Knife Behind a Smile:</strong> Win your enemy's trust with friendship, then strike when their guard is down.</p>
                        <p id="stratagem-11"><strong>11. Sacrifice the Plum Tree to Preserve the Peach Tree:</strong> Suffer a minor, calculated loss to secure a major gain.</p>
                        <p id="stratagem-12"><strong>12. Take the Opportunity to Pilfer a Goat:</strong> Seize any small, unforeseen advantage. Be flexible and opportunistic.</p>
                    </div>
                </div>
                <div>
                    <h4 class="!mt-8 !border-b-gray-700 text-lg">III. Attacking Stratagems</h4>
                     <div class="space-y-4 mt-4">
                        <p id="stratagem-13"><strong>13. Stomp the Grass to Scare the Snake:</strong> Make an indirect move to provoke a reaction from the enemy, revealing their plans.</p>
                        <p id="stratagem-14"><strong>14. Borrow a Corpse to Resurrect the Soul:</strong> Revive something from the past (an idea, a tradition) to serve a new purpose.</p>
                        <p id="stratagem-15"><strong>15. Lure the Tiger Down from the Mountain:</strong> Entice a strong enemy away from their advantageous, fortified position.</p>
                        <p id="stratagem-16"><strong>16. In Order to Capture, One Must Let Loose:</strong> Give your enemy an apparent escape route to lower their morale and then ambush them as they flee.</p>
                        <p id="stratagem-17"><strong>17. Toss Out a Brick to Get a Jade Gem:</strong> Bait the enemy with something of little value to get something of great value in return.</p>
                        <p id="stratagem-18"><strong>18. Defeat the Enemy by Capturing Their Chief:</strong> If you can neutralize the leader, the rest of the organization will collapse.</p>
                    </div>
                </div>
                <div>
                    <h4 class="!mt-8 !border-b-gray-700 text-lg">IV. Chaos Stratagems</h4>
                     <div class="space-y-4 mt-4">
                        <p id="stratagem-19"><strong>19. Remove the Firewood from Under the Pot:</strong> Attack the enemy's source of strength (supply lines, alliances), not their direct military power.</p>
                        <p id="stratagem-20"><strong>20. Disturb the Water and Catch a Fish:</strong> Create chaos and confusion to exploit the situation for your own benefit.</p>
                        <p id="stratagem-21"><strong>21. Slough Off the Cicada's Golden Shell:</strong> Create a decoy to escape, leaving behind an empty "shell" while your real forces move undetected.</p>
                        <p id="stratagem-22"><strong>22. Shut the Door to Catch the Thief:</strong> When dealing with a weak enemy, encircle them completely before attacking.</p>
                        <p id="stratagem-23"><strong>23. Befriend a Distant State While Attacking a Neighbor:</strong> Build alliances with those far away to isolate and threaten your immediate rivals.</p>
                        <p id="stratagem-24"><strong>24. Obtain Safe Passage to Conquer Guo:</strong> Ask to borrow passage from an ally to attack a common enemy, but then use that position to turn on the ally.</p>
                    </div>
                </div>
                <div>
                    <h4 class="!mt-8 !border-b-gray-700 text-lg">V. Proximate Stratagems</h4>
                     <div class="space-y-4 mt-4">
                        <p id="stratagem-25"><strong>25. Replace Beams with Rotten Timbers:</strong> Subtly sabotage the enemy's foundations by replacing their key assets with inferior ones.</p>
                        <p id="stratagem-26"><strong>26. Point at Mulberry while Cursing Locust:</strong> Issue an indirect threat to intimidate your real target without a direct confrontation.</p>
                        <p id="stratagem-27"><strong>27. Feign Madness but Keep Your Balance:</strong> Pretend to be foolish or insane to make the enemy underestimate you.</p>
                        <p id="stratagem-28"><strong>28. Remove the Ladder When the Enemy has Ascended:</strong> Lure your enemy into a trap and then cut off their escape route.</p>
                        <p id="stratagem-29"><strong>29. Deck the Tree with False Blossoms:</strong> Use decoys and illusions to make your forces appear much stronger than they are.</p>
                        <p id="stratagem-30"><strong>30. Make the Host and Guest Exchange Roles:</strong> Usurp the leadership position in a situation you were invited into.</p>
                    </div>
                </div>
                <div>
                    <h4 class="!mt-8 !border-b-gray-700 text-lg">VI. Desperate Stratagems</h4>
                     <div class="space-y-4 mt-4">
                        <p id="stratagem-31"><strong>31. The Beauty Trap (Honey Trap):</strong> Use the allure of a person to sow discord within the enemy camp.</p>
                        <p id="stratagem-32"><strong>32. The Empty Fort Strategy:</strong> When you are defenseless, act calmly. Your opponent, fearing an ambush, may withdraw.</p>
                        <p id="stratagem-33"><strong>33. Let the Enemy's Own Spy Sow Discord:</strong> Use an enemy agent against them by feeding them false information.</p>
                        <p id="stratagem-34"><strong>34. Inflict Injury on Oneself to Win Trust:</strong> Feign an injury or weakness to lower the enemy's guard or to "surrender" as a spy.</p>
                        <p id="stratagem-35"><strong>35. Chain Stratagems:</strong> Combine multiple stratagems in a linked sequence, so that if one fails, another can still succeed.</p>
                        <p id="stratagem-36"><strong>36. If All Else Fails, Retreat:</strong> If your situation is untenable, retreat to fight another day. Preserving your strength is a victory in itself.</p>
                    </div>
                </div>
            </div>
        </div>
    </details>
</section>

<!-- DIDACTIC FUNNEL PART 3: THE SYNTHESIS -->
<section id="s8_synthesis" class="page-section">
    <h2>The Synthesis: The Daimyō's Mindset</h2>
    <p class="text-gray-400 mb-6">True mastery comes from synthesizing your clan's strengths with timeless strategic principles. This is not about following a script, but about cultivating a mindset. Consider these connections as you forge your path to victory.</p>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="info-card">
            <h4 class="!mt-0">Hōjō & Awaiting the Exhausted</h4>
            <p>The Hōjō's "Unbreakable Wall" ability embodies <strong>Stratagem #4</strong>. Build your fortress early, garrison it modestly, and use your main army to conquer surrounding lands while your enemies waste resources trying to crack your home province.</p>
        </div>
        <div class="info-card">
            <h4 class="!mt-0">Mōri & Luring the Tiger</h4>
            <p>If an enemy has a powerful army turtled in a key inland position (the "mountain"), the Mōri can use their naval power to launch a surprise attack on their undefended coast, forcing the "tiger" to abandon its safe position. This is a direct application of <strong>Stratagem #15</strong>.</p>
        </div>
        <div class="info-card">
             <h4 class="!mt-0">Uesugi & Capturing by Letting Loose</h4>
            <p>A wise Uesugi player can intentionally leave a less valuable province lightly defended, baiting an opponent into attacking. The attacker is now overextended. This is <strong>Stratagem #16</strong>, creating an opportunity for a decisive counter-attack.</p>
        </div>
        <div class="info-card">
            <h4 class="!mt-0">Otomo & Tossing Out a Brick</h4>
            <p>The Otomo ability costs 2 Koku (the "brick") to re-roll attacks. Save it for a decisive battle against a high-value target like a Daimyō or Mandate Province (the "jade gem") to turn a fight into a glorious victory, a perfect example of <strong>Stratagem #17</strong>.</p>
        </div>
        <div class="info-card">
            <h4 class="!mt-0">Tokugawa & Watching the Fires</h4>
            <p>The Tokugawa's defensive nature allows them to build power slowly. Let your rivals engage in costly wars, consolidating your mountain strongholds. Strike when they are weakened, as advised by <strong>Stratagem #9</strong>.</p>
        </div>
        <div class="info-card">
            <h4 class="!mt-0">Takeda & Feinting East</h4>
            <p>The Takeda's unmatched speed makes them masters of <strong>Stratagem #6</strong>. Threaten one front to draw enemy reserves, then use your 3-province movement to strike a completely different, undefended target.</p>
        </div>
    </div>
</section>
`,


'timing': `
<section id="page-timing" class="page-container">
    <div class="py-12 px-4"><div class="max-w-4xl mx-auto">
        <header>
            <h2 class="!mt-0" id="timing_heading">Detailed Timing & Action Structure</h2>
        </header>
        <section>
            <p>This document provides a granular, step-by-step breakdown of the game's sequences. Use the controls below to update the timing structure based on the optional modules in your game.</p>

            <div id="timing-module-toggles" class="info-card bg-gray-900 border-accent-secondary my-8">
                <h3 class="!mt-0 !border-b-accent-secondary/50">Activate Modules to Update Timing</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <label class="flex items-center space-x-3 cursor-pointer">
                        <input type="checkbox" data-module-toggle="political-play" class="h-5 w-5 rounded border-gray-600 bg-gray-800 text-accent-primary focus:ring-accent-primary">
                        <span>Political Play & Blood Feud ⚖️</span>
                    </label>
                    <label class="flex items-center space-x-3 cursor-pointer">
                        <input type="checkbox" data-module-toggle="specialized-warfare" class="h-5 w-5 rounded border-gray-600 bg-gray-800 text-accent-primary focus:ring-accent-primary">
                        <span>Specialized Warfare 🛡️</span>
                    </label>
                    <label class="flex items-center space-x-3 cursor-pointer">
                        <input type="checkbox" data-module-toggle="cycle-of-rice" class="h-5 w-5 rounded border-gray-600 bg-gray-800 text-accent-primary focus:ring-accent-primary">
                        <span>The Cycle of Rice and War 🌾</span>
                    </label>
                    <label class="flex items-center space-x-3 cursor-pointer">
                        <input type="checkbox" data-module-toggle="path-of-glory" class="h-5 w-5 rounded border-gray-600 bg-gray-800 text-accent-primary focus:ring-accent-primary">
                        <span>Path of Glory 🏆</span>
                    </label>
                </div>
            </div>

            <div class="table-responsive-wrapper">
                <h3 class="!border-b-0 !text-center !mb-0" id="timing_round_structure">Part 1: The Round Timing Structure</h3>
                <table class="table-structured">
                    <thead><tr><th data-label="Step">Step</th><th data-label="Action">Action</th><th data-label="Notes">Player(s) & Notes</th></tr></thead>
                    <tbody>
                        <tr class="module-row"><td colspan="3" class="text-center font-bold">1.0. Phase 1: Planning & Reinforcement</td></tr>
                        <tr><td data-label="Step"><strong>1.1</strong></td><td data-label="Action"><strong>Income & Administration Step</strong></td><td data-label="Notes"><strong>Simultaneous</strong></td></tr>
                        <tr data-is-replaced-by="cycle-of-rice"><td data-label="Step"></td><td data-label="Action" class="pl-12">1.1.1. Collect Income (<a href="#s4_1" class="nav-link-inline">§4.1</a>)</td><td data-label="Notes">Add 3 Koku + 1 Koku per province.</td></tr>
                        <tr data-module="cycle-of-rice"><td data-label="Step"></td><td data-label="Action" class="pl-12">1.1.1a. Daimyō's Stipend (<a href="#s10_3" class="nav-link-inline">§10.3</a>) <span title="The Cycle of Rice and War Module" class="module-icon">🌾</span></td><td data-label="Notes"><strong>Module Only:</strong> Collect only base income of 4 Koku.</td></tr>
                        <tr data-module="cycle-of-rice"><td data-label="Step"></td><td data-label="Action" class="pl-12">1.1.1b. Sowing Step (<a href="#s10_3" class="nav-link-inline">§10.3</a>) <span title="The Cycle of Rice and War Module" class="module-icon">🌾</span></td><td data-label="Notes"><strong>Module Only:</strong> Sow, store or keep Koku.</td></tr>
                        <tr data-is-replaced-by="cycle-of-rice"><td data-label="Step"></td><td data-label="Action" class="pl-12">1.1.2. Pay Unit Maintenance (<a href="#s4_1" class="nav-link-inline">§4.1</a>)</td><td data-label="Notes">Pay 1 Koku per 2 Bushi.</td></tr>
                        <tr><td data-label="Step"></td><td data-label="Action" class="pl-12">1.1.3. Determine Player Order (<a href="#s4_1" class="nav-link-inline">§4.1</a>)</td><td data-label="Notes">Fewest provinces go first.</td></tr>
                        <tr data-is-replaced-by="path-of-glory"><td data-label="Step"><strong>1.2</strong></td><td data-label="Action"><strong>Vassal Decision Point</strong></td><td data-label="Notes"><strong>Vassals Only</strong> (Replaced by "Path of Glory" module).</td></tr>
                        <tr data-is-replaced-by="path-of-glory"><td data-label="Step"></td><td data-label="Action" class="pl-12">1.2.1. Choose Path to Liberation (<a href="#s8_1_2" class="nav-link-inline">§8.1.2</a>)</td><td data-label="Notes">Binding choice for the round.</td></tr>
                        <tr><td data-label="Step"><strong>1.3</strong></td><td data-label="Action"><strong>Recruitment & Construction Step</strong></td><td data-label="Notes"><strong>In Player Order</strong></td></tr>
                        <tr><td data-label="Step"></td><td data-label="Action" class="pl-12">1.3.1. First player recruits/builds.</td><td data-label="Notes">Continues sequentially.</td></tr>
                        <tr data-module="political-play"><td data-label="Step"><strong>1.3a</strong></td><td data-label="Action"><strong>Diplomacy Step</strong> <span title="Political Play Module" class="module-icon">⚖️</span></td><td data-label="Notes"><strong>Module Only:</strong> "Political Play"</td></tr>
                        <tr data-module="political-play"><td data-label="Step"></td><td data-label="Action" class="pl-12">1.3a.1. Offer/Accept Honor Pacts (<a href="#s10_1" class="nav-link-inline">§10.1</a>)</td><td data-label="Notes">Performed sequentially in player order.</td></tr>
                        <tr><td data-label="Step"><strong>1.4</strong></td><td data-label="Action"><strong>End of Phase Checkpoint</strong></td><td data-label="Notes"></td></tr>
                        <tr><td data-label="Step"></td><td data-label="Action" class="pl-12">1.4.1. Check for Victory Conditions (<a href="#s1_1_2" class="nav-link-inline">§1.1.2</a>)</td><td data-label="Notes">Game ends if met.</td></tr>
                        <tr class="module-row"><td colspan="3" class="text-center font-bold">2.0. Phase 2: Campaign</td></tr>
                        <tr><td data-label="Step"><strong>2.1</strong></td><td data-label="Action"><strong>Movement Step</strong></td><td data-label="Notes"><strong>In Player Order</strong></td></tr>
                        <tr><td data-label="Step"></td><td data-label="Action" class="pl-12">2.1.1. First player moves all units.</td><td data-label="Notes">Continues sequentially.</td></tr>
                        <tr><td data-label="Step"><strong>2.2</strong></td><td data-label="Action"><strong>Battle Resolution Step</strong></td><td data-label="Notes"><strong>In Player Order</strong></td></tr>
                        <tr><td data-label="Step"></td><td data-label="Action" class="pl-12">2.2.1. First player resolves all their initiated battles.</td><td data-label="Notes">Player chooses order of their battles.</td></tr>
                        <tr><td data-label="Step"><strong>2.3</strong></td><td data-label="Action"><strong>End of Phase Checkpoint</strong></td><td data-label="Notes"></td></tr>
                        <tr><td data-label="Step"></td><td data-label="Action" class="pl-12">2.3.1. Check for Victory Conditions (<a href="#s1_1_2" class="nav-link-inline">§1.1.2</a>)</td><td data-label="Notes">Game ends if met.</td></tr>
                        <tr class="module-row"><td colspan="3" class="text-center font-bold">3.0. Phase 3: Winter</td></tr>
                        <tr data-is-replaced-by="cycle-of-rice"><td data-label="Step"><strong>3.1</strong></td><td data-label="Action"><strong>Mountain Provisions Step</strong></td><td data-label="Notes"><strong>Simultaneous</strong>.</td></tr>
                        <tr data-module="cycle-of-rice"><td data-label="Step"><strong>3.1a</strong></td><td data-label="Action"><strong>Harvest Step</strong> <span title="The Cycle of Rice and War Module" class="module-icon">🌾</span></td><td data-label="Notes"><strong>Module Only:</strong> "Cycle of Rice & War"</td></tr>
                        <tr data-module="cycle-of-rice"><td data-label="Step"></td><td data-label="Action" class="pl-12">Receive Koku from Sowing (<a href="#s10_3" class="nav-link-inline">§10.3</a>).</td><td data-label="Notes"></td></tr>
                        <tr data-module="cycle-of-rice"><td data-label="Step"><strong>3.1b</strong></td><td data-label="Action"><strong>Module Mountain Provisions Step</strong> <span title="The Cycle of Rice and War Module" class="module-icon">🌾</span></td><td data-label="Notes"><strong>Module Only:</strong> "Cycle of Rice & War"</td></tr>
                        <tr data-module="cycle-of-rice"><td data-label="Step"></td><td data-label="Action" class="pl-12">Pay Unit Maintenance & Mountain Costs (<a href="#s10_3" class="nav-link-inline">§10.3</a>).</td><td data-label="Notes"></td></tr>
                        <tr data-module="cycle-of-rice"><td data-label="Step"><strong>3.1c</strong></td><td data-label="Action"><strong>Spoilage Step</strong> <span title="The Cycle of Rice and War Module" class="module-icon">🌾</span></td><td data-label="Notes"><strong>Module Only:</strong> Discard half of Koku left in Treasury (rounded down)</td></tr>
                        <tr><td data-label="Step"><strong>3.2</strong></td><td data-label="Action"><strong>End of Phase Checkpoint</strong></td><td data-label="Notes"></td></tr>
                        <tr><td data-label="Step"></td><td data-label="Action" class="pl-12">3.2.1. Check for Victory Conditions (<a href="#s1_1_2" class="nav-link-inline">§1.1.2</a>).</td><td data-label="Notes">Game ends if met.</td></tr>
                        <tr><td data-label="Step"></td><td data-label="Action" class="pl-12">3.2.2. If no winner, round ends.</td><td data-label="Notes">Proceed to next round.</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="table-responsive-wrapper">
                <h3 class="!border-b-0 !text-center !mb-0" id="timing_combat_structure">Part 2: The Combat Timing Structure</h3>
                <table class="table-structured">
                    <thead><tr><th data-label="Step">Step</th><th data-label="Action">Action</th><th data-label="Notes">Notes</th></tr></thead>
                    <tbody>
                    <tr><td data-label="Step"><strong>1.0</strong></td><td data-label="Action"><strong>Announce Combat</strong></td><td data-label="Notes">Attacker declares which battle.</td></tr>
                    <tr><td data-label="Step"><strong>2.0</strong></td><td data-label="Action"><strong>Hire Ronin Step</strong></td><td data-label="Notes">Attacker, then Defender(s).</td></tr>
                    <tr><td data-label="Step"><strong>3.0</strong></td><td data-label="Action"><strong>Ninja Assassination Step</strong></td><td data-label="Notes">Window for Ninja player to act.</td></tr>
                    <tr data-module="specialized-warfare"><td data-label="Step"><strong>4.0</strong></td><td data-label="Action"><strong>Firearm Phase</strong> <span title="Specialized Warfare Module" class="module-icon">🛡️</span></td><td data-label="Notes"><strong>Module Only:</strong> "Technological Change"</td></tr>
                    <tr data-module="specialized-warfare"><td data-label="Step"></td><td data-label="Action" class="pl-12">4.1. Arquebusiers fire and resolve hits.</td><td data-label="Notes"></td></tr>
                    <tr data-module="specialized-warfare"><td data-label="Step"><strong>5.0</strong></td><td data-label="Action"><strong>Archery Phase (First Strike)</strong> <span title="Specialized Warfare Module" class="module-icon">🛡️</span></td><td data-label="Notes"><strong>Module Only:</strong> Specialized Warfare</td></tr>
                    <tr data-module="specialized-warfare"><td data-label="Step"></td><td data-label="Action" class="pl-12">5.1. Archers use First Strike ability.</td><td data-label="Notes"></td></tr>
                    <tr><td data-label="Step"><strong>6.0</strong></td><td data-label="Action"><strong>Melee Phase</strong></td><td data-label="Notes"></td></tr>
                    <tr><td data-label="Step"></td><td data-label="Action" class="pl-12">6.1. All sides determine total hits.</td><td data-label="Notes"></td></tr>
                    <tr><td data-label="Step"></td><td data-label="Action" class="pl-12">6.2. All sides assign hits.</td><td data-label="Notes"></td></tr>
                    <tr><td data-label="Step"></td><td data-label="Action" class="pl-12">6.3. All marked units are removed simultaneously.</td><td data-label="Notes"></td></tr>
                    <tr><td data-label="Step"><strong>7.0</strong></td><td data-label="Action"><strong>Conclude Combat</strong></td><td data-label="Notes">Remove Ronin, resolve Raiding (<a href="#s6_2_7" class="nav-link-inline">§6.2.7</a>).</td></tr>
                    </tbody>
                </table>
            </div>
        </section>
        <hr class="section-divider">
        <div class="text-center mt-12">
            <a href="ShogunTimingAid.html" target="\_blank" class="inline-block bg-accent-primary text-white font-bold py-3 px-6 rounded-lg no-underline hover:bg-blue-400 transition-colors">
                Download Timing Reference (for Printing)
            </a>
        </div>
    </div></div>
</section>
`,
                'reference': `
                <section id="page-reference" class="page-container">
                    <div class="py-12 px-4"><div class="max-w-4xl mx-auto">
                        <header>
                            <h2 class="!mt-0">The Strategist's Arsenal: Reference & Cheatsheets</h2>
                        </header>
                        <section>
                            <p>This page serves as a quick reference during the game. It's structured didactically, from the most basic procedures to specific rules for advanced concepts.</p>
                            <hr class="section-divider">
                            <h2 id="ref_stufe1">Level 1: The Basics at the Table</h2>
                            <p>Everything every player needs at a glance.</p>
                            <div class="info-card">
                                <h3 class="!mt-0" id="ref_rundenablauf">The Round Sequence (Core Game)</h3>
                                <ol class="list-decimal list-inside space-y-2">
                                    <li><strong>Phase 1: Planning & Reinforcement</strong>
                                        <ul class="list-disc list-inside ml-4">
                                            <li><strong>Income & Administration (Simultaneous):</strong> Receive income, pay Unit Maintenance (skip on turn 1), determine player order (Gekokujō).</li>
                                            <li><strong>Recruitment & Construction (In Player Order):</strong> Recruit Bushi, hire Ninja, build castles.</li>
                                        </ul>
                                    </li>
                                    <li><strong>Phase 2: Campaign</strong>
                                        <ul class="list-disc list-inside ml-4">
                                            <li><strong>Movement (In Player Order):</strong> Move all units.</li>
                                            <li><strong>Resolve Battles (In Player Order):</strong> Resolve all resulting battles one by one.</li>
                                        </ul>
                                    </li>
                                    <li><strong>Phase 3: Winter</strong>
                                        <ul class="list-disc list-inside ml-4">
                                            <li><strong>Mountain Provisions (Simultaneous):</strong> Pay Mountain Provisions costs for units in mountain provinces. <span title="The Cycle of Rice and War Module" class="module-icon">🌾</span></li>
                                        </ul>
                                    </li>
                                </ol>
                            </div>
                            <div class="info-card">
                                <h3 class="!mt-0" id="ref_kampfablauf">The Combat Sequence</h3>
                                <ol class="list-decimal list-inside space-y-2">
                                    <li><strong>(Optional) Hire Ronin:</strong> Attacker, then Defender.</li>
                                    <li><strong>(Optional) Ninja Assassination:</strong> Covert Ninja is revealed.</li>
                                    <li><strong>Determine Hits:</strong> All units roll dice simultaneously.</li>
                                    <li><strong>Assign & Remove Casualties:</strong> Assign hits, then remove all marked units.</li>
                                    <li><strong>Determine Outcome:</strong> Province controlled, neutral, or contested.</li>
                                </ol>
                            </div>
                            <div class="info-card">
                                <h3 class="!mt-0" id="ref_clans">The Great Clans at a Glance</h3>
                                <div class="table-responsive-wrapper">
                                    <table class="table-structured">
                                        <thead><tr><th data-label="Clan">Clan</th><th data-label="Archetype">Archetype</th><th data-label="Strength">Strength</th><th data-label="Weakness">Weakness</th></tr></thead>
                                        <tbody>
                                            <tr><td data-label="Clan"><strong>Chosokabe</strong></td><td data-label="Archetype">Economist</td><td data-label="Strength">High, flexible income.</td><td data-label="Weakness">No direct military bonuses.</td></tr>
                                            <tr><td data-label="Clan"><strong>Hōjō</strong></td><td data-label="Archetype">Builder</td><td data-label="Strength">Superior, cost-effective defense.</td><td data-label="Weakness">Static; power is tied to one location.</td></tr>
                                            <tr><td data-label="Clan"><strong>Mōri</strong></td><td data-label="Archetype">Naval Power</td><td data-label="Strength">Exceptional strategic mobility.</td><td data-label="Weakness">Reliant on controlling specific sea zones.</td></tr>
                                            <tr><td data-label="Clan"><strong>Oda</strong></td><td data-label="Archetype">Aggressor</td><td data-label="Strength">Superior combat effectiveness.</td><td data-label="Weakness">Reliant on exposed Daimyō.</td></tr>
                                            <tr><td data-label="Clan"><strong>Otomo</strong></td><td data-label="Archetype">Gambler</td><td data-label="Strength">Ability to win decisive battles through investment.</td><td data-label="Weakness">Koku-intensive; can be baited.</td></tr>
                                            <tr><td data-label="Clan"><strong>Shimazu</strong></td><td data-label="Archetype">Expansionist</td><td data-label="Strength">Rapid early economic growth.</td><td data-label="Weakness">Predictable strategic goals.</td></tr>
                                            <tr><td data-label="Clan"><strong>Takeda</strong></td><td data-label="Archetype">Mobile Force</td><td data-label="Strength">Unmatched force projection.</td><td data-label="Weakness">Power is concentrated.</td></tr>
                                            <tr><td data-label="Clan"><strong>Tokugawa</strong></td><td data-label="Archetype">Turtle</td><td data-label="Strength">Extremely resilient heartland.</td><td data-label="Weakness">Can become passive.</td></tr>
                                            <tr><td data-label="Clan"><strong>Uesugi</strong></td><td data-label="Archetype">Defender</td><td data-label="Strength">Cost-effective, attritional defense.</td><td data-label="Weakness">Purely reactive.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <hr class="section-divider">
                            <h2 id="ref_stufe2">Level 2: Core Mechanics in Detail</h2>
                            <p>The most frequently referenced values and rules in one place.</p>
                            <div class="info-card">
                                <h3 class="!mt-0" id="ref_wirtschaft">Cheat Sheet: The Economic Cycle</h3>
                                <div class="table-responsive-wrapper">
                                    <table>
                                        <thead><tr><th data-label="Action">Action</th><th data-label="Cost/Yield">Cost / Yield</th><th data-label="When">When?</th></tr></thead>
                                        <tbody>
                                            <tr><td data-label="Action"><strong>Base Income</strong></td><td data-label="Cost/Yield">+3 Koku</td><td data-label="When">Phase 1.1</td></tr>
                                            <tr><td data-label="Action"><strong>Province Income</strong></td><td data-label="Cost/Yield">+1 Koku per Province</td><td data-label="When">Phase 1.1</td></tr>
                                            <tr><td data-label="Action"><strong>Unit Maintenance</strong></td><td data-label="Cost/Yield">-1 Koku per 2 Bushi (rounded up)</td><td data-label="When">Phase 1.1 (Skipped on Turn 1)</td></tr>
                                            <tr><td data-label="Action"><strong>Recruitment</strong></td><td data-label="Cost/Yield">-1 Koku per Bushi</td><td data-label="When">Phase 1.2</td></tr>
                                            <tr><td data-label="Action"><strong>Hire Ronin</strong></td><td data-label="Cost/Yield">-1 Koku per Ronin</td><td data-label="When">Combat</td></tr>
<tr><td data-label="Action"><strong>Hire Ronin (Vassal Assault)</strong></td><td data-label="Cost/Yield">-1 Koku per 2 Ronin</td><td data-label="When">Combat</td></tr>
                                            <tr class="module-row"><td data-label="Action"><strong>Winter Mountain Provisions</strong> <span title="The Cycle of Rice and War Module" class="module-icon">🌾</span></td><td data-label="Cost/Yield">-1 Koku per Mountain Province + -1 Koku per 3 units there</td><td data-label="When">Phase 3 (Replaced by Module)</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="info-card">
                                <h3 class="!mt-0" id="ref_kampfwerte">Cheat Sheet: Combat Values & Modifiers</h3>
                                <p><strong>Base Values</strong></p>
                                <div class="table-responsive-wrapper">
                                    <table><thead><tr><th data-label="Unit">Unit</th><th data-label="Dice">Dice</th><th data-label="Attack">Attack Hits On</th><th data-label="Defense">Defense Hits On</th></tr></thead><tbody><tr><td data-label="Unit">Bushi</td><td data-label="Dice">1d6</td><td data-label="Attack">5-6</td><td data-label="Defense">6</td></tr><tr><td data-label="Unit">Daimyō</td><td data-label="Dice">3d6</td><td data-label="Attack">4-6</td><td data-label="Defense">4-6</td></tr></tbody></table>
                                </div>
                                <p class="mt-8"><strong>Possible Modifiers (Highest bonus/penalty applies, §0.1)</strong></p>
                                <div class="table-responsive-wrapper">
                                    <table>
                                        <thead><tr><th data-label="Source">Source</th><th data-label="Effect">Effect</th><th data-label="Condition">Condition</th></tr></thead>
                                        <tbody>
                                            <tr><td data-label="Source"><strong>Oda Clan</strong></td><td data-label="Effect">+1 on attack rolls</td><td data-label="Condition">Oda Daimyō is present.</td></tr>
                                            <tr><td data-label="Source"><strong>Uesugi Clan</strong></td><td data-label="Effect">+1 on defense rolls</td><td data-label="Condition">Province was controlled at start of round.</td></tr>
                                            <tr><td data-label="Source"><strong>Kyoto (Province)</strong></td><td data-label="Effect">+1 on defense rolls</td><td data-label="Condition">Defender in Yamashiro (Kyoto).</td></tr>
                                            <tr><td data-label="Source"><strong>Castle</strong></td><td data-label="Effect">+1 on defense rolls</td><td data-label="Condition">Defender in province with a castle.</td></tr>
                                            <tr><td data-label="Source"><strong>Hōjō Fortress</strong></td><td data-label="Effect">+2 on defense rolls</td><td data-label="Condition">Hōjō player defending in their Fortress province.</td></tr>
                                            <tr><td data-label="Source"><strong>Fortified Castle</strong></td><td data-label="Effect">+2 on defense rolls</td><td data-label="Condition">Defender in province with a fortified castle (for 1 round).</td></tr>
                                            <tr><td data-label="Source"><strong>Ninja (Sabotage)</strong></td><td data-label="Effect">-1 on defense rolls</td><td data-label="Condition">Ninja is on a Sabotage mission in the province.</td></tr>
                                            <tr class="module-row"><td data-label="Source"><strong>Honor Pact Broken</strong> <span title="Political Play Module" class="module-icon">⚖️</span></td><td data-label="Effect">-1 on attack rolls</td><td data-label="Condition"><em>(Module)</em> You are attacking an ally.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="info-card">
                                <h3 class="!mt-0" id="ref_provinces">Cheat Sheet: Province Types</h3>
                                <p>This list is for at-a-glance reference for rules concerning specific terrain types. A province can be both coastal and mountainous.</p>
                                <h4 class="mt-8">Mountain Provinces</h4>
                                <p>These provinces incur extra Mountain Provisions costs during the Winter phase (unless you are Tokugawa).</p>
                                <ul class="list-disc list-inside grid grid-cols-2 md:grid-cols-3 gap-x-4">
                                    <li>Shinano</li>
                                    <li>Kai</li>
                                    <li>Hida</li>
                                    <li>Etchu</li>
                                    <li>Mino</li>
                                    <li>Kozuke</li>
                                </ul>
                                <h4 class="mt-8">Coastal Provinces</h4>
                                <p>These provinces interact with certain clan abilities (e.g., Shimazu, Chosokabe).</p>
                                <ul class="list-disc list-inside grid grid-cols-2 md:grid-cols-3 gap-x-4">
                                    <li>Satsuma</li>
                                    <li>Tosa</li>
                                    <li>Owari</li>
                                    <li>Echigo</li>
                                    <li>Settsu (Osaka)</li>
                                    <li>Sagami (Edo)</li>
                                    <li>Nagato</li>
                                    <li>Suruga</li>
                                    <li>Aki</li>
                                    <li>Bungo</li>
                                </ul>
                                <h4 class="mt-8">Mandate Provinces</h4>
                                <p>Control of these three provinces is required for the "Shōgun's Mandate" victory condition.</p>
                                <ul class="list-disc list-inside grid grid-cols-2 md:grid-cols-3 gap-x-4">
                                    <li>Yamashiro (Kyoto)</li>
                                    <li>Settsu (Osaka)</li>
                                    <li>Sagami (Edo)</li>
                                </ul>
                            </div>
                            <hr class="section-divider">
                            <h2 id="ref_stufe3">Level 3: Advanced Concepts</h2>
                            <p>Quick references for modules and more specific rules.</p>
                            <div class="info-card">
                                <h3 class="!mt-0" id="ref_ninja">Cheat Sheet: The Ninja</h3>
                                <div class="table-responsive-wrapper">
                                    <table>
                                        <thead><tr><th data-label="Type">Mission Type</th><th data-label="Sub-Type">Sub-Type</th><th data-label="Effect">Effect</th></tr></thead>
                                        <tbody>
                                            <tr><td data-label="Type"><strong>Field Operation (Public)</strong></td><td data-label="Sub-Type">Sabotage</td><td data-label="Effect">-1 on defense rolls & no recruitment in province for 1 round.</td></tr>
                                            <tr><td data-label="Type"><strong>Field Operation (Public)</strong></td><td data-label="Sub-Type">Diversion</td><td data-label="Effect">Province cannot be attacked this round.</td></tr>
                                            <tr><td data-label="Type"><strong>Assassination (Covert)</strong></td><td data-label="Sub-Type">Assassination</td><td data-label="Effect">At start of combat, remove one enemy Bushi (not with a Daimyō).</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="info-card">
                                <h3 class="!mt-0" id="ref_module">Cheat Sheet: Modules at a Glance</h3>
                                <div class="table-responsive-wrapper">
                                    <table>
                                        <thead><tr><th data-label="Module">Module</th><th data-label="Changes">Replaces / Changes</th><th data-label="Adds">Adds</th></tr></thead>
                                        <tbody>
                                            <tr><td data-label="Module"><strong>Political Play</strong> <span title="Political Play Module" class="module-icon">⚖️</span></td><td data-label="Changes">-</td><td data-label="Adds">Honor Pacts (alliances), betrayal.</td></tr>
                                            <tr><td data-label="Module"><strong>Specialized Warfare</strong> <span title="Specialized Warfare Module" class="module-icon">🛡️</span></td><td data-label="Changes">Standard Bushi</td><td data-label="Adds">Spearmen, Swordsmen, Archers; Ranged Phase.</td></tr>
                                            <tr><td data-label="Module"><strong>The Cycle of Rice and War</strong> <span title="The Cycle of Rice and War Module" class="module-icon">🌾</span></td><td data-label="Changes">Standard Winter & Unit Maintenance in Phase 1</td><td data-label="Adds">Provincial Investment, Harvest Events, Raiding, Storing Rice, Spoilage.</td></tr>
                                            <tr><td data-label="Module"><strong>Path of Glory</strong> <span title="Path of Glory Module" class="module-icon">🏆</span></td><td data-label="Changes">Vassalage System (§8.1)</td><td data-label="Adds">Comeback mechanic with Glory Points for defeated players.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <h4 class="mt-8">Module Compatibility</h4>
                                <div class="table-responsive-wrapper">
                                    <table>
                                        <thead><tr><th data-label="Combo">Combination</th><th data-label="Complexity">Complexity</th><th data-label="Notes">Notes</th></tr></thead>
                                        <tbody>
                                            <tr><td data-label="Combo">Political Play + Any</td><td data-label="Complexity">Low Increase</td><td data-label="Notes">Adds negotiation without heavy system interaction.</td></tr>
                                            <tr class="!bg-red-900/20"><td data-label="Combo">Specialized Warfare + The Cycle of Rice and War</td><td data-label="Complexity"><strong>High Increase</strong></td><td data-label="Notes">Recommended for expert players only.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <hr class="section-divider">
                            <div class="text-center mt-12">
                                <a href="ShogunPlayerAid.html" target="\_blank" class="inline-block bg-accent-primary text-white font-bold py-3 px-6 rounded-lg no-underline hover:bg-blue-400 transition-colors">
                                    Download Player Aid (for Printing)
                                </a>
                            </div>
                            <hr class="section-divider">
                            <h3 id="s9_1_ref">Glossary</h3>
                            <ul id="glossary-list" class="list-none space-y-2">
                                <li><strong>Assassination:</strong> A covert Ninja mission that can be revealed at the start of a combat to remove one enemy Bushi.</li>
                                <li><strong>Attacker:</strong> The player who moves units into a province occupied by an opponent.</li>
                                <li><strong>Bushi:</strong> Standard warrior figures, the backbone of your army.</li>
                                <li><strong>Castle / Fortress:</strong> A defensive structure that grants a +1 bonus to defense rolls in its province. The Hōjō Fortress provides a +2 bonus.</li>
                                <li><strong>Clan:</strong> The faction each player controls, each with a unique starting position and ability.</li>

                                <li><strong>Contested:</strong> This is a specific state of an uncontrolled province in which units from more than one player are located. This state typically occurs after a failed retreat or due to other game effects. Although it is not empty, it has no controller.</li>

                                <li><strong>Controlled:</strong> A province is considered controlled if it contains units belonging to only one player. Only the controlling player can use the province's special ability and recruit from it.</li>

                                <li><strong>Daimyō:</strong> Your three irreplaceable leader units. They are powerful in combat but cannot be recruited again if lost.</li>
                                <li><strong>Defender:</strong> The player whose province is being entered by an attacker's units.</li>
                                <li><strong>Enemy Target:</strong> A target (unit, province, etc.) is considered an enemy if it is controlled by another clan or can be legally targeted by an attack. This includes neutral but attackable factions like the Ikkō-ikki rebels.</li>
                                <li><strong>Field Operation:</strong> A public Ninja mission (Sabotage or Diversion) that must be declared during the Reinforcement phase.</li>
                                <li><strong>Gekokujō:</strong> The core principle that determines turn order; the player with the fewest provinces acts first.</li>
                                <li><strong>Glory Points (GP):</strong> A resource gained by a defeated player for achieving legendary feats, such as defeating an enemy Daimyō. Reaching 7 GP wins the game.</li>
                                <li><strong>Honor Pact:</strong> A formal, single-round alliance between two players that allows for joint occupation of provinces.</li>
                                <li><strong>Koku:</strong> The game's currency, representing rice and resources used to pay for armies and construction.</li>
                                <li><strong>Mandate Provinces:</strong> The three special provinces (Yamashiro (Kyoto), Settsu (Osaka), and Sagami (Edo)) required for the Shōgun's Mandate victory.</li>
                                <li><strong>Module:</strong> An optional set of rules that can be added to the core game to change or deepen the experience.</li>
                                <li><strong>Province:</strong> A single territory or area on the game board.</li>
                                <li><strong>Raiding:</strong> The act of seizing an opponent's Sown Koku tokens from a province immediately after conquering it.</li>
                                <li><strong>Ronin:</strong> Mercenaries hired for a single battle who are removed from the board after combat.</li>
                                <li><strong>Shōgun's Mandate:</strong> An alternative victory condition achieved by gaining sole, undisputed control of the three Mandate Provinces.</li>
                                <li><strong>Spoilage:</strong> The loss of half of a player's unspent, un-stored Koku at the very end of the Winter phase.</li>
                                <li><strong>Stacking Limit:</strong> The maximum number of a single player's units (7) allowed to be in a single province at the end of a movement action.</li>
                                <li><strong>Mountain Provisions Costs:</strong> The Koku paid during the Winter phase for controlling mountain provinces and for the units stationed within them.</li>
                                <li><strong>Unit Maintenance:</strong> The cost in Koku required at the start of each round to maintain your army of Bushi.</li>

                                <li><strong>Uncontrolled:</strong> A province is considered uncontrolled if there are no units in it or if there are units from more than one player. An uncontrolled province has no owner, its special ability is inactive, and no one can recruit there. A contested province is a type of uncontrolled province.</li>

                                <li><strong>Vassal:</strong> A player who has lost their last Daimyō. A Vassal cannot win but can work to become free again.</li>
                            </ul>
                        </section>
                    </div></div>
                </section>
                `,
                'feedback': `
                <section id="page-feedback" class="page-container">
                    <div class="py-12 px-4">
                        <div class="max-w-4xl mx-auto">
                            <header>
                                <h2 class="!mt-0">Feedback & Playtest Reports</h2>
                            </header>
                            <section>
                                <p>Your insights are the most valuable resource for balancing and refining Shogun: Gekokujō. Whether you've found a potential typo, have a question about a rule interaction, or want to share a detailed report from your latest game night, this is the place to do it.</p>
                                <div class="info-card">
                                    <h3 class="!mt-0">Submit Your Feedback</h3>
                                    <p>Please use the form below to send your thoughts directly to the design team. All feedback is read and appreciated.</p>
                                    <form action="https://form.taxi/s/oovjf8vx" method="POST" class="mt-6 space-y-6">
                                        <div>
                                            <label for="name" class="form-label">Name<span class="required-asterisk">*</span></label>
                                            <input type="text" name="Name" id="name" class="form-input" required>
                                        </div>
                                        <div>
                                            <label for="mail" class="form-label">Email address<span class="required-asterisk">*</span></label>
                                            <input type="email" name="Email" id="mail" class="form-input" required>
                                        </div>
                                        <div>
                                            <label for="msg" class="form-label">Your message<span class="required-asterisk">*</span></label>
                                            <textarea rows="6" name="Message" id="msg" class="form-textarea" required></textarea>
                                        </div>
                                        <div>
                                            <label class="flex items-center text-sm">
                                                <input type="checkbox" name="Data processing confirmed" value="Yes" required class="mr-2 h-4 w-4 rounded border-gray-600 bg-gray-800 text-accent-primary focus:ring-accent-primary">
                                                I agree to the processing of my entries.<span class="required-asterisk">*</span>
                                            </label>
                                        </div>
                                        <!-- Honeypot field for spam protection -->
                                        <input type="text" name="\_gotcha" style="display:none" value="">
                                        <div>
                                            <button type="submit" class="form-button">Submit</button>
                                        </div>
                                    </form>
                                </div>
                            </section>
                        </div>
                    </div>
                </section>
                `,
                'about': `
                <section id="page-about" class="page-container">
                    <div class="py-12 px-4"><div class="max-w-4xl mx-auto">
                        <header>
                            <h2 class="!mt-0">10. The Living Rulebook</h2>
                        </header>
                        <section>
                            <p>This is more than a rulebook; it is the foundation of a partnership between the designers and you, the players. A game truly comes alive on the table, and it is there—through countless sessions of brilliant plays, surprising tactics, and heated debates—that its true form is revealed.</p>
                            <p>We honor this process by treating this document as a "living rulebook". It is built to adapt and grow, incorporating the collective wisdom of its community to achieve a state of perfect elegance and balance. Every game you play is a playtest, and every piece of feedback you share is a contribution to this shared project.</p>
                            <p>We believe that the most resilient and beloved games are those that are stewarded by their communities. To that end, this document is released under the Creative Commons Attribution 4.0 International License.</p>
                            <p>This isn't just a license; it's an invitation. It empowers you to become a co-creator, to help us identify ambiguities, refine mechanics, and ensure the game remains a vibrant and challenging experience for years to come.</p>
                            <div class="info-card mt-12">
                                <h3 class="!mt-0">Join the Community</h3>
                                <p>This living rulebook is a community project. Join the discussion, ask questions, report issues, and find other players at the official BoardGameGeek forum.</p>
                                <div class="text-center mt-6">
                                    <a href="https://boardgamegeek.com/filepage/306500/shogun-gekokujo-version-shogun-re-imagined" target="\_blank" rel="noopener noreferrer" class="inline-block bg-accent-secondary text-white font-bold py-3 px-6 rounded-lg no-underline hover:bg-yellow-400 transition-colors">
                                        Visit the BGG Forum
                                    </a>
                                </div>
                            </div>
                            <div class="text-center mt-12">
                                <button id="download-offline-btn" class="inline-block bg-accent-primary text-white font-bold py-3 px-6 rounded-lg no-underline hover:bg-blue-400 transition-colors">
                                    Download for Offline Use
                                </button>
                                <p class="text-sm text-gray-500 mt-2">(Saves a single .html file with all rules)</p>
                            </div>
                        </section>
                        <hr class="section-divider">
                        <section>
                            <h2 class="!mt-0">11. License</h2>
                            <p>This work is licensed under the <strong>Creative Commons Attribution 4.0 International License</strong>. To view the full legal code, visit <a href="https://creativecommons.org/licenses/by/4.0/" target="\_blank" rel="noopener noreferrer">creativecommons.org/licenses/by/4.0/</a>.</p>
                            <div class="info-card">
                                <h4 class="!mt-0">You are free to:</h4>
                                <ul class="list-disc list-inside space-y-2">
                                    <li><strong>Share</strong> — copy and redistribute the material in any medium or format for any purpose, even commercially.</li>
                                    <li><strong>Adapt</strong> — remix, transform, and build upon the material for any purpose, even commercially.</li>
                                </ul>
                                <p class="text-sm mt-4">The licensor cannot revoke these freedoms as long as you follow the license terms.</p>
                            </div>
                            <div class="info-card">
                                <h4 class="!mt-0">Under the following terms:</h4>
                                <ul class="list-disc list-inside space-y-2">
                                    <li><strong>Attribution</strong> — You must give appropriate credit, provide a link to the license, and indicate if changes were made. You may do so in any reasonable manner, but not in any way that suggests the licensor endorses you or your use.</li>
                                    <li><strong>No additional restrictions</strong> — You may not apply legal terms or technological measures that legally restrict others from doing anything the license permits.</li>
                                </ul>
                            </div>
                        </section>
                    </div></div>
                </section>
                `
            };

            for (const pageId in contentMap) {
                const pageContent = contentMap[pageId];
                const section = document.createElement('div'); // Using div to avoid nested sections
                section.innerHTML = pageContent;
                // The content is wrapped in a <section>, so we append its children
                while (section.firstChild) {
                    appWrapper.appendChild(section.firstChild);
                }
            }
        };

        // --- SCRIPT EXECUTION ---
        loadContent();
        populateBottomNav();
        initThemeToggle();
        initEventListeners();
        initTOC();
        initMobileNav();
        initDesktopTOC();
        initOfflineDownload();
        initResponsiveTables();
        initProgressBar();
        handleNavigation();
        initMisc(); // Call initMisc after content is loaded and structured
        initTimingModuleToggles(); // <-- ADD THIS LINE
    };

    if (!window.shogunRulebookInitialized) {
        init();
        window.shogunRulebookInitialized = true;
    }
});



