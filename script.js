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

    // --- CORE INITIALIZATION ---
    const init = () => {
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
            const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

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
            }, { rootMargin: '-20% 0px -70% 0px' });

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
            if (keys.length === 0) return;
            const regex = new RegExp(`\\b(${keys.join('|')})\\b`, 'gi');

            const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => {
                    if (!node.parentElement || node.parentElement.closest('script, style, .tooltip, a, h1, h2, h3, h4, h5, #glossary-list')) {
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
                    // Clone the item, remove the strong tag, and get the remaining text
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

        const initDesktopTOC = () => {
            if (!tocContainer || !appWrapper) return;
            
            tocContainer.addEventListener('mouseenter', () => {
                tocContainer.classList.add('is-expanded');
                if (window.innerWidth >= 1024) appWrapper.style.paddingLeft = 'var(--toc-width-expanded)';
                ['toc-title', 'toc-search-container', 'toc-list', 'toc-no-results'].forEach(id => {
                    const el = getEl(id);
                    if (el) el.classList.remove('opacity-0');
                });
            });
            tocContainer.addEventListener('mouseleave', () => {
                tocContainer.classList.remove('is-expanded');
                if (window.innerWidth >= 1024) appWrapper.style.paddingLeft = 'var(--toc-width-collapsed)';
                 ['toc-title', 'toc-search-container', 'toc-list', 'toc-no-results'].forEach(id => {
                    const el = getEl(id);
                    if (el) el.classList.add('opacity-0');
                });
            });

            const tocSearch = getEl('toc-search');
            const tocList = getEl('toc-list');
            const noResults = getEl('toc-no-results');
            if (tocSearch && tocList && noResults) {
                const searchHandler = (e) => {
                    const term = e.target.value.toLowerCase().trim();
                    let visibleCount = 0;
                    tocList.querySelectorAll('li').forEach(li => {
                        const isVisible = li.textContent.toLowerCase().includes(term);
                        li.style.display = isVisible ? 'block' : 'none';
                        if (isVisible) visibleCount++;
                    });
                    noResults.style.display = visibleCount === 0 ? 'block' : 'none';
                };
                tocSearch.addEventListener('input', debounce(searchHandler, 250));
            }
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
                                <p class="text-lg mt-2">Rulebook v79 (Living Rulebook)</p>
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
                                        <h3 class="!mt-0">1. The Economic Engine: Upkeep is Everything</h3>
                                        <p><strong>THE OLD WAY:</strong> You received Koku based on your province count and had to spend it all each round on bidding for turn order or buying units. Armies were free to maintain.</p>
                                        <p><strong>THE NEW WAY (GEKOKUJŌ):</strong> Armies now have an ongoing <strong>Upkeep cost</strong> every single round (1 Koku for every 2 Bushi). This is the single most important change. Income is now a stable base amount plus Koku per province.</p>
                                        <p><strong>STRATEGIC IMPACT:</strong> You can no longer build massive, unstoppable armies ("doomstacks") without an economy to support them. The game is now a tense balancing act between military expansion and economic sustainability. An overextended army will bankrupt your clan.</p>
                                    </div>
                                    <div class="info-card">
                                        <h3 class="!mt-0">2. Turn Order: The Gekokujō Principle</h3>
                                        <p><strong>THE OLD WAY:</strong> Turn order was determined by bidding Koku for swords. The wealthiest player could often secure the first turn.</p>
                                        <p><strong>THE NEW WAY (GEKOKUJŌ):</strong> Turn order is now a core catch-up mechanic. The player with the <strong>fewest provinces</strong> goes first. This is the Gekokujō Principle: "the low overthrow the high."</p>
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
                            <section>
                                <div class="info-card bg-gray-900 border-accent-secondary">
                                    <h3 class="!mt-0 !border-b-accent-secondary/50" id="game_night_kit">The Daimyō's Kit for Game Night</h3>
                                    <p>Everything you need to get your game started quickly after a long time away from the battlefield.</p>
                                    <h4 class="mt-8 text-accent-secondary">1. Visual Component List</h4>
                                    <ul class="list-none space-y-2">
                                        <li class="flex items-center"><span class="text-2xl mr-4">🏯</span> 3 Daimyō figures per clan</li>
                                        <li class="flex items-center"><span class="text-2xl mr-4">⚔️</span> 69 Bushi cubes per clan</li>
                                        <li class="flex items-center"><span class="text-2xl mr-4">💰</span> Koku coins for your treasury</li>
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
                                        <li><strong>Upkeep:</strong> This step is skipped on the first turn of the game. All players have 4 Koku to spend.</li>
                                        <li><strong>Recruitment (Oda's Turn):</strong> The Oda player acts first. They plan for their next turn: if they conquer one province, they will have 2 provinces, giving them 5 Koku income (3+2). Their upkeep would then be 1 Koku for 2 Bushi. To fuel an aggressive opening, Oda spends 3 Koku to recruit 3 Bushi, leaving 1 Koku in their treasury. The new Bushi are placed in their home province of Owari.</li>
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
                                    <p>No player controls a mountain province, so no Winter Supply costs are paid. At the end of the round, Oda controls 2 provinces. They have established a forward position for their next campaign, but because they now have more provinces than the others, they will likely act later in the next round due to the Gekokujō principle.</p>
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
                                    <li><strong>Rebuilding (Safe & Slow):</strong> Each round, put up to 3 Koku in a "Liberation Fund." At 10 Koku, you're free.</li>
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
                                <h2 class="!mt-0" id="s0_heading"><span class="rule-number">§ 0</span>Golden Rules</h2>
                                <div class="info-card border-accent-secondary bg-gray-900">
                                    <h3 class="mt-0" id="s0_1"><span class="rule-number">§ 0.1</span>Rule of the Highest Source</h3>
                                    <p><strong>Only the single largest bonus and the single largest penalty of each type apply. Types are defined by their effect (e.g., "defense roll bonus", "income bonus"). All bonuses to defense rolls are considered the same type, regardless of their source (clan ability, castle, etc.). They do not stack.</strong><br><em class="text-sm text-gray-400 mt-2 block">Example 1: A defending Uesugi unit (+1 defense) in a province with a castle (+1 defense) receives only a single +1 bonus to its defense rolls, not +2.</em><br><em class="text-sm text-gray-400 mt-2 block">Example 2: A defending Hōjō unit in their Fortress (+2 defense) that is targeted by a Ninja's Sabotage (-1 defense) would resolve its defense rolls with a net +1 bonus. This confirms that bonuses and penalties apply concurrently.</em></p>
                                </div>
                                <h3 class="mt-16" id="s0_2"><span class="rule-number">§ 0.2</span>Module Rules Break Core Rules</h3>
                                <p><strong>The rule of an optional module always takes precedence over a core rule it directly contradicts.</strong></p>
                            </section>
                            <hr class="section-divider">
                            <section id="s1">
                                <h2 class="!mt-0" id="s1_heading"><span class="rule-number">§ 1</span>THE CORE GAME</h2>
                                <h3 class="mt-16" id="s1_1"><span class="rule-number">§ 1.1</span>The Goal of the War</h3>
                                <h4 class="mt-16" id="s1_1_1"><span class="rule-number">§ 1.1.1</span>Victory Conditions</h4>
                                <p>Victory is achieved by meeting one of two conditions:</p>
                                <ul class="list-disc list-inside">
                                    <li>a) <strong>Province Control</strong> (see <a href="#s1_2" class="nav-link-inline">§1.2</a>)</li>
                                    <li>b) <strong>The Shōgun's Mandate</strong> (see <a href="#s1_3" class="nav-link-inline">§1.3</a>)</li>
                                </ul>
                                <p><em>The game ends immediately when a victory condition is met.</em> In case of a simultaneous fulfillment, the priority is:</p>
                                <ol class="list-decimal list-inside ml-8">
                                    <li>Shōgun's Mandate</li>
                                    <li>Province Control</li>
                                    <li>Path of Glory (Module, see <a href="#s10_4" class="nav-link-inline">§10.4</a>)</li>
                                </ol>
                                <h4 class="mt-16" id="s1_1_2"><span class="rule-number">§ 1.1.2</span>Timing of Victory Check</h4>
                                <p><strong>Victory conditions apply only at the end of each phase.</strong></p>
                                <h3 class="mt-16" id="s1_2"><span class="rule-number">§ 1.2</span>Victory by Province Control</h3>
                                <p>You win immediately if you control a certain number of provinces:</p>
                                <ul class="list-disc list-inside">
                                    <li><strong>4 Players:</strong> 20 provinces</li>
                                    <li><strong>5 Players:</strong> 18 provinces</li>
                                </ul>
                                <h4 class="mt-16" id="s1_2_1"><span class="rule-number">§ 1.2.1</span>Tie-Breaker</h4>
                                <p>In the rare case of a tie, a clear winner is determined by the following sequence:</p>
                                <ol class="list-decimal list-inside space-y-1">
                                    <li><strong>Economic Strength:</strong> The tied player with more <strong>Koku</strong> wins.</li>
                                    <li><strong>Leadership Preservation:</strong> The player with the most <strong>Daimyō</strong> remaining wins.</li>
                                    <li><strong>Strategic Prestige:</strong> The player who controls the most <strong>Mandate Provinces</strong> wins.</li>
                                    <li><strong>Initiative:</strong> The player who would have acted <strong>earlier in the next round's turn order</strong> wins.</li>
                                </ol>
                                <h3 class="mt-16" id="s1_3"><span class="rule-number">§ 1.3</span>Alternative Victory: The Shōgun's Mandate</h3>
                                <p>You win immediately if you have sole, undisputed control over the three Mandate Provinces:</p>
                                <ul class="list-disc list-inside ml-8">
                                    <li>Yamashiro (Kyoto)</li>
                                    <li>Settsu (Osaka)</li>
                                    <li>Sagami (Edo)</li>
                                </ul>
                                <p class="mt-4"><em>There must be no units from allies (see <a href="#s10_1" class="nav-link-inline">§10.1</a>) in these provinces for you to claim this victory.</em></p>
                                <p><em>Special Rule: When defending in Yamashiro (Kyoto), your units receive a +1 bonus to their defense rolls.</em></p>
                            </section>
                            <hr class="section-divider">
                            <section id="s2">
                                <h2 class="!mt-0" id="s2_heading"><span class="rule-number">§ 2</span>Preparing for Battle</h2>
                                <h3 class="mt-16" id="s2_1"><span class="rule-number">§ 2.1</span>Components</h3>
                                <ul class="list-disc list-inside">
                                <li><strong>Daimyō (3 per clan):</strong> Your irreplaceable leaders.</li>
                                <li><strong>Bushi (69 per clan):</strong> The backbone of your clan.</li>
                                <li><strong>Koku:</strong> The lifeblood of your clan, representing rice and resources.</li>
                                <li><strong>Ronin (30 total):</strong> Masterless samurai for hire.</li>
                                <li><strong>Castles (10 total):</strong> Fortifications for your provinces.</li>
                                <li><strong>Ninja (1 total):</strong> A master of espionage.</li>
                                <li><strong>Player Screens, Game Board, six-sided dice (d6), and various markers.</strong></li>
                            </ul>
                                <!-- NEW DRAFT SECTION -->
                                <h3 class="mt-16" id="s2_2"><span class="rule-number">§ 2.2</span>The Eve of War: Clan Selection</h3>
                                <p>To ensure a balanced and strategically engaging conflict, the great clans are selected through a draft. This guarantees a wide geographic distribution of power, preventing strategic isolation and fostering immediate interaction.</p>
                                <h4 class="mt-16" id="s2_2_1"><span class="rule-number">§ 2.2.1</span>Define the Strategic Regions</h4>
                                <p>The nine great clans are grouped into three strategic regions, reflecting their historical spheres of influence.</p>
                                <ul class="list-disc list-inside">
                                    <li><strong>The West:</strong> Mōri (Aki), Otomo (Bungo), Shimazu (Satsuma)</li>
                                    <li><strong>The Center:</strong> Chosokabe (Tosa), Oda (Owari), Tokugawa (Mikawa)</li>
                                    <li><strong>The East:</strong> Hōjō (Sagami), Takeda (Kai), Uesugi (Echigo)</li>
                                </ul>
                                <h4 class="mt-16" id="s2_2_2"><span class="rule-number">§ 2.2.2</span>Step-by-Step: The Draft Procedure</h4>
                                <p>A draft is a simple way to choose factions to ensure a fair and interesting game. Instead of everyone grabbing their favorite clan at once, you will take turns picking one by one. This section breaks it down into simple steps.</p>
                                <h5 class="mt-12" id="s2_2_2_1"><span class="rule-number">§ 2.2.2.1</span> Step 1: Determine the Pick Order</h5>
                                <p>Determine a random starting order for the players (e.g., by rolling dice). The player who would act <strong>last</strong> in this random order gets to pick their clan <strong>first</strong>. The clan pick order is the reverse of the randomly determined player order.</p>
                                <div class="info-card mt-4">
                                    <h5 class="!mt-0">Designer's Note on Initial Order</h5>
                                    <p>As all players begin the game with an identical number of provinces (0), Koku (0), and units (0), the standard Gekokujō tie-breakers cannot apply. A random method is therefore required to establish the initial draft order. This ensures fairness and resolves the logical inconsistency of needing a clan name to determine the order in which clan names are chosen.</p>
                                </div>
                                <h5 class="mt-12" id="s2_2_2_2"><span class="rule-number">§ 2.2.2.2</span> Step 2: Make Your Picks (with one restriction)</h5>
                                <p>Starting with the first player in the pick order, each player chooses one available clan. There is only one special rule for the first few picks:</p>
                                <blockquote><strong>The Regional Restriction Rule:</strong> The first three players picking must each choose a clan from a different, unclaimed <strong>Strategic Region</strong> (West, Center, or East). Once all three regions have been chosen from, this restriction is lifted for any remaining players.</blockquote>
                                <p>This ensures that the clans are spread out across the map, creating an interactive game from the very beginning.</p>
                                <h4 class="mt-16" id="s2_2_3">Example Draft Walkthrough (4-Player Game)</h4>
                                <p><em>Let's walk through an example with these steps.</em></p>
                                <ol class="list-decimal list-inside space-y-2 mt-4">
                                    <li><strong>Determine Pick Order:</strong> The players roll dice to establish a random turn order. The result is: Player D → C → B → A. The clan draft pick order is the reverse of this: <strong>Player A → B → C → D.</strong></li>
                                    <li><strong>Player A (picks 1st):</strong> Player A must pick a clan. They choose the <strong>Takeda</strong> from the <strong>East</strong>. The "East" region is now considered claimed for the initial picks.</li>
                                    <li><strong>Player B (picks 2nd):</strong> Player B must pick from an unclaimed region (West or Center). They select the <strong>Oda</strong> from the <strong>Center</strong>. The "Center" region is now claimed.</li>
                                    <li><strong>Player C (picks 3rd):</strong> Player C must pick from the last unclaimed region, the <strong>West</strong>. They choose the <strong>Shimazu</strong>. All three regions are now represented.</li>
                                    <li><strong>Player D (picks 4th):</strong> The Regional Restriction is now lifted. Player D can choose any of the remaining clans from any region.</li>
                                </ol>
                                <p class="mt-4">This draft system becomes a "meta-game" before the first turn. Your initial choice is not just about which clan ability you prefer; it also limits the options of your opponents and shapes the political landscape of the entire game.</p>
                                <!-- RENAMED SETUP SECTION -->
                                <h3 class="mt-16" id="s2_3"><span class="rule-number">§ 2.3</span>Initial Setup</h3>
                                <ol class="list-decimal list-inside">
                                    <li><strong>Place Starting Units:</strong> Each player places three Daimyō and <strong>one</strong> Bushi in their clan's starting province.</li>
                                    <li><strong>Receive Starting Capital:</strong> Each player receives three Koku.</li>
                                    <li><strong>First Turn Exception:</strong> On the first turn of the game only, players do not pay the Upkeep cost.</li>
                                </ol>
                                <!-- RENAMED CLANS SECTION -->
                                <h3 class="mt-16" id="s2_4"><span class="rule-number">§ 2.4</span>The Great Clans</h3>
                                <blockquote>The clans are not fundamentally different, but their unique advantages reflect their historical strengths and strategic focus.</blockquote>
                                <div class="table-responsive-wrapper">
                                    <table class="table-structured">
                                        <thead><tr><th data-label="Clan">Clan</th><th data-label="Archetype">Archetype</th><th data-label="Province">Province</th><th data-label="Ability Name">Ability Name</th><th data-label="Ability">Ability</th></tr></thead>
                                        <tbody>
                                            <tr><td data-label="Clan"><strong>Chosokabe</strong></td><td data-label="Archetype">Economist</td><td data-label="Province">Tosa</td><td data-label="Ability Name">Island Economy</td><td data-label="Ability">Your base income is 4 Koku (instead of 3). Additionally, you gain +1 Koku for every 2 coastal provinces you control (max +2 Koku per round).</td></tr>
                                            <tr><td data-label="Clan"><strong>Hōjō</strong></td><td data-label="Archetype">Builder</td><td data-label="Province">Sagami</td><td data-label="Ability Name">The Unbreakable Wall</td><td data-label="Ability">The cost to build your Fortress is 3 Koku. Its defense bonus is +2 (instead of +1). If your Fortress is destroyed, you may rebuild it in a later round for the same cost.</td></tr>
                                            <tr><td data-label="Clan"><strong>Mōri</strong></td><td data-label="Archetype">Naval Power</td><td data-label="Province">Aki</td><td data-label="Ability Name">Masters of the Inland Sea</td><td data-label="Ability">Movement between two Mōri-controlled provinces that border the same sea zone costs only 1 movement point, even if they share no land border. Additionally, you gain +1 Koku for every 3 coastal provinces you control.</td></tr>
                                            <tr><td data-label="Clan"><strong>Oda</strong></td><td data-label="Archetype">Aggressor</td><td data-label="Province">Owari</td><td data-label="Ability Name">The Shogun's Vanguard</td><td data-label="Ability">If an Oda Daimyō is present, all attacking Oda units in that battle receive a +1 bonus to their attack rolls.</td></tr>
                                            <tr><td data-label="Clan"><strong>Otomo</strong></td><td data-label="Archetype">Gambler</td><td data-label="Province">Bungo</td><td data-label="Ability Name">Nanban Trade</td><td data-label="Ability">When you declare an attack, you may spend 2 Koku before any dice are rolled. If you do, you may re-roll all of your failed attack rolls for your Bushi units in that battle.</td></tr>
                                            <tr><td data-label="Clan"><strong>Shimazu</strong></td><td data-label="Archetype">Expansionist</td><td data-label="Province">Satsuma</td><td data-label="Ability Name">Masters of the Western Seas</td><td data-label="Ability">+1 Koku per coastal province you control (max +3 per round).</td></tr>
                                            <tr><td data-label="Clan"><strong>Takeda</strong></td><td data-label="Archetype">Mobile Force</td><td data-label="Province">Kai</td><td data-label="Ability Name">The Wind of Kai</td><td data-label="Ability">When a Takeda Daimyō moves, up to 6 Bushi from the same starting province may move with him as a single group, using the Daimyō's movement of 3.</td></tr>
                                            <tr><td data-label="Clan"><strong>Tokugawa</strong></td><td data-label="Archetype">Turtle</td><td data-label="Province">Mikawa</td><td data-label="Ability Name">Masters of the Mountains</td><td data-label="Ability">Immune to supply costs in mountain provinces.</td></tr>
                                            <tr><td data-label="Clan"><strong>Uesugi</strong></td><td data-label="Archetype">Defender</td><td data-label="Province">Echigo</td><td data-label="Ability Name">The Dragon's Domain</td><td data-label="Ability">Any Uesugi unit defending in a province under your control at the start of this round receives a +1 bonus to its defense rolls.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                            <hr class="section-divider">
                            <section id="s3">
                                <h2 class="!mt-0" id="s3_heading"><span class="rule-number">§ 3</span>The Round Structure</h2>
                                <blockquote>Each round mirrors a year of feudal war. Spring Planning -> Summer Campaign -> Harsh Winter. Mastering this rhythm of Logistics -> Operations -> Attrition is the true path to becoming Shogun.</blockquote>
                                <h3 class="mt-16" id="s3_1"><span class="rule-number">§ 3.1</span>Phase Overview</h3>
                                <ol class="list-decimal list-inside"><li><strong>Phase 1a: Administration</strong> (Income, Upkeep, Player Order)</li><li><strong>Phase 1b: Reinforcement</strong> (Recruitment & Construction)</li><li><strong>Phase 2: Campaign</strong> (Movement & Combat)</li><li><strong>Phase 3: Winter</strong> (Supply)</li></ol>
                            </section>
                            <hr class="section-divider">
                            <section id="s4">
                                <h2 class="!mt-0" id="s4_heading"><span class="rule-number">§ 4</span>Phase 1a: Administration</h2>
                                <h3 class="mt-16" id="s4_1"><span class="rule-number">§ 4.1</span>Income, Upkeep & Gekokujō (Sequential-Simultaneous)</h4>
                                <p>Though these steps are completed by all players before moving on, they are resolved in a strict sequence to prevent timing conflicts:</p>
                                <ol class="list-decimal list-inside">
                                    <li><strong>1. Collect Income:</strong> All players simultaneously gain 3 Koku base income + 1 Koku per controlled province.</li>
                                    <li><strong>2. Pay Upkeep:</strong> All players simultaneously pay 1 Koku for every 2 Bushi units (rounded up). Daimyō are free. <em>(This is skipped on the first turn of the game).</em></li>
                                    <li><strong>3. Determine Player Order (Gekokujō):</strong> Only after all income and upkeep have been fully resolved, the player order for the round is determined. The player with the fewest provinces acts first. Ties are broken by: 1st - less Koku, 2nd - fewer total units, 3rd - clan name alphabetically.</li>
                                </ol>
                                <h3 class="mt-16" id="s4_2"><span class="rule-number">§ 4.2</span>Honor & Bankruptcy</h3>
                                <p>A Daimyō is bound by their word and must meet their financial obligations. If a player is unable to pay a required cost (Upkeep, Winter Supply, etc.) at any time, they must immediately remove <strong>two</strong> of their Bushi units (player's choice) from the board for every 1 Koku they cannot pay. A clan cannot go into debt.</p>
                                <p class="mt-4 italic">For example, if you are short 3 Koku, you must immediately remove 6 of your Bushi from the board.</p>
                            </section>
                            <hr class="section-divider">
                            <section id="s5">
                                <h2 class="!mt-0" id="s5_heading"><span class="rule-number">§ 5</span>Phase 1b: Reinforcement</h2>
                                <h3 class="mt-16" id="s5_1"><span class="rule-number">§ 5.1</span>Recruitment & Construction (In Player Order)</h4>
                                <ol class="list-decimal list-inside">
                                    <li><strong>Recruit:</strong> Pay 1 Koku per Bushi.</li>
                                    <li><strong>Hire Ninja:</strong> Pay 3 Koku (see <a href="#s9_1" class="nav-link-inline">§9.1</a>).</li>
                                    <li><strong>Castle & Fortress Construction:</strong> Spend Koku to build or fortify a castle (see <a href="#s9_2" class="nav-link-inline">§9.2</a>).</li>
                                </ol>
                                <h3 class="mt-16" id="s5_2"><span class="rule-number">§ 5.2</span>Unit Placement</h4>
                                <p>All newly recruited units must be placed in a province that you controlled at the start of the Planning & Reinforcement phase.</p>
                            </section>
                            <hr class="section-divider">
                            <section id="s6">
                                <h2 class="!mt-0" id="s6_heading"><span class="rule-number">§ 6</span>Phase 2: Campaign</h2>
                                <p>After all players have completed their reinforcements, the Campaign phase begins, proceeding in the newly established player order.</p>
                                <h3 class="mt-16" id="s6_1"><span class="rule-number">§ 6.1</span>&nbsp;Movement</h3>
<h4 class="mt-16" id="s6_1_1"><span class="rule-number">§ 6.1.1</span>&nbsp;General Movement</h4>
<p>A player may move any number of their units during their Movement Phase.</p>
<h4 class="mt-16" id="s6_1_2"><span class="rule-number">§ 6.1.2</span>&nbsp;Group Movement: Splitting & Merging Armies</h4>
<p>Units can conduct their movement independently. This allows for two fundamental maneuvers:</p>
<ul class="list-disc list-inside ml-4">
    <li><strong>Splitting Armies:</strong> Multiple units starting their movement in the same province may move to different destination provinces.</li>
    <li><strong>Merging Armies:</strong> Multiple units starting their movement in different provinces may end their movement in the same destination province.</li>
</ul>
<h4 class="mt-16" id="s6_1_3"><span class="rule-number">§ 6.1.3</span>&nbsp;Movement Restrictions</h4>
<p>All movement is subject to the following universal restrictions:</p>
<ul class="list-disc list-inside ml-4">
    <li><strong>Movement Range:</strong> Bushi may move up to 2 provinces; Daimyō may move up to 3.</li>
    <li><strong>Entering Enemy Territory:</strong> A unit's or army's movement must end immediately upon entering a province containing an enemy player's units (unless an Honor Pact is in effect, see §10.1).</li>
    <li><strong>Stacking Limit:</strong> A province may not contain more than 7 of a single player's units at the end of their movement.</li>
</ul>
                                <h3 class="mt-16" id="s6_2"><span class="rule-number">§ 6.2</span>The Art of War: Combat</h3>
                                <p>Combat occurs when units of different players are in the same province after the active player has completed all of their movement. The player whose turn it is is the attacker. All combat rolls are made using standard six-sided dice (d6).</p>
                                <h4 class="mt-16" id="s6_2_1"><span class="rule-number">§ 6.2.1</span>The Combat Sequence</h4>
                                <ol class="list-disc list-inside">
                                    <li>(Optional) <strong>Hire Ronin:</strong> Attacker, then defender, may hire Ronin.</li>
                                    <li>(Optional) <strong>Ninja Assassination:</strong> Reveal Ninja if on a mission.</li>
                                    <li><strong>Determine Hits:</strong> All units from all sides roll dice simultaneously to determine the number of hits they score.</li>
                                    <li><strong>Assign & Remove Casualties:</strong> Starting with the attacker, each player assigns their hits to enemy units. After all hits are assigned, all marked units are removed from the board at the same time.</li>
                                    <li><strong>Check for Control:</strong> If units from only one side remain, that player controls the province. If units from more than one side remain, or no units remain, the province becomes neutral.</li>
                                    <li>(Module) <strong>Raiding:</strong> If using module §10.3, the new controller seizes any invested Koku (see §6.2.7).</li>
                                </ol>
                                <h4 class="mt-16" id="s6_2_2"><span class="rule-number">§ 6.2.2</span>Combat With 3+ Players</h4>
                                <p>In a battle involving three or more players, all sides roll their dice simultaneously. Then, a player who has been attacked distributes their hits first. Finally, all players remove casualties at the same time.</p>
                                <h4 class="mt-16" id="s6_2_3"><span class="rule-number">§ 6.2.3</span>Combat Rolls</h4>
                                <div class="table-responsive-wrapper"><table class="table-structured"><thead><tr><th data-label="Unit">Unit</th><th data-label="Dice">Dice</th><th data-label="Attack Hits">Attack Hits</th><th data-label="Defense Hits">Defense Hits</th></tr></thead><tbody><tr><td data-label="Unit">Bushi</td><td data-label="Dice">1d6</td><td data-label="Attack Hits">5-6</td><td data-label="Defense Hits">6</td></tr><tr><td data-label="Unit">Daimyō</td><td data-label="Dice">3d6</td><td data-label="Attack Hits">4-6</td><td data-label="Defense Hits">4-6</td></tr></tbody></table></div>
                                <h4 class="mt-16" id="s6_2_4"><span class="rule-number">§ 6.2.4</span>Ronin: Mercenaries</h4>
                                <ul class="list-disc list-inside">
                                    <li><strong>Hiring:</strong> Pay 1 Koku per Ronin to add them to a battle.</li>
                                    <li><strong>Combat Profile:</strong> Ronin act as Bushi in all respects during combat, rolling one die and hitting on a 5-6 when attacking or a 6 when defending. They are affected by all applicable combat modifiers.</li>
                                    <li><strong>Limit:</strong> You may not have more Ronin than your own Bushi in a battle.</li>
                                    <li><strong>Fleeting Loyalty:</strong> After combat, all Ronin are removed from the board.</li>
                                </ul>
                                <h4 class="mt-16" id="s6_2_5"><span class="rule-number">§ 6.2.5</span>Example of Basic Combat</h3>
                                <p>The Tokugawa player attacks a neutral province with 3 Bushi. It is defended by 2 Ronin hired by another player. No other modifiers are in play.</p>
                                <ul class="list-disc list-inside">
                                    <li><strong>Tokugawa (Attacking):</strong> Rolls 3 dice for their 3 Bushi. An attack hits on a 5-6. They roll a 1, 4, and 5. This is \*\*1 hit\*\*.</li>
                                    <li><strong>Ronin (Defending):</strong> Rolls 2 dice for the 2 Ronin. A defense hits on a 6. They roll a 2 and 6. This is \*\*1 hit\*\*.</li>
                                    <li><strong>Resolving:</strong> Each side scored 1 hit. The Tokugawa player removes one Bushi, and the Ronin player removes one Ronin. The Tokugawa player now has 2 Bushi in the province, and the Ronin player has 1. The province remains contested.</li>
                                </ul>
                                <h4 class="mt-16" id="s6_2_6"><span class="rule-number">§ 6.2.6</span>Example of Combat with Modifiers</h3>
                                <p>The Oda player attacks Echigo, defended by Uesugi. Attacker has 1 Daimyō, 3 Bushi. Defender has 4 Bushi and a castle.</p>
                                <h5 class="mt-16" id="s6_2_6_1"><span class="rule-number">§ 6.2.6.1</span>Calculating Target Numbers</h5>
                                <ul class="list-disc list-inside">
                                    <li><strong>Oda (Attacking):</strong> Oda Daimyō is present, so clan ability applies (+1). Daimyō hits on 3-6, Bushi on 4-6.</li>
                                    <li><strong>Uesugi (Defending):</strong> Uesugi has +1 from clan ability and +1 from the castle. Per Golden Rule §0.1, only one +1 bonus applies. Bushi hit on 5-6.</li>
                                </ul>
                                <h5 class="mt-16" id="s6_2_6_2"><span class="rule-number">§ 6.2.6.2</span>Rolling Dice & Resolving</h4>
                                <p>Oda rolls for 1 Daimyō (3 dice) and 3 Bushi (3 dice), getting 4 hits total. Uesugi rolls for 4 Bushi (4 dice), getting 2 hits. Uesugi removes all 4 of their Bushi. Oda removes 2 Bushi. Oda now controls Echigo.</p>
                                <h4 class="mt-16 module-row" id="s6_2_7"><span class="rule-number">§ 6.2.7</span>Raiding Invested Provinces <span title="The Cycle of Rice and War Module" class="module-icon">🌾</span></h4>
                                <p><em>This rule is only in effect when using \*\*The Cycle of Rice and War\*\* module (<a href="#s10_3" class="nav-link-inline">§10.3</a>).</em></p>
                                <p>If an attacker gains control of a province that contains invested Koku tokens from the Sowing step, the attacker immediately seizes all Koku tokens from that province and adds them to their own treasury. This occurs at the end of combat, after all units have been removed and control is determined.</p>
                            </section>
                            <hr class="section-divider">
                            <section id="s7">
                                <h2 class="!mt-0" id="s7_heading"><span class="rule-number">§ 7</span>Phase 3: Winter</h2>
                                <p>After all players have completed their Campaign phase, the Winter phase occurs simultaneously for all players.</p>
                                <h3 class="mt-16" id="s7_1"><span class="rule-number">§ 7.1</span>Pay Supply Costs</h3>
                                <p><strong>Pay 1 Koku for each mountain province you control, PLUS 1 Koku per 3 units (any type, rounded up) located across all those mountain provinces.</strong></p>
                                <p class="mt-4 italic text-gray-400">● This rule is replaced by \*\*The Cycle of Rice and War\*\* module (<a href="#s10_3" class="nav-link-inline">§10.3</a>).<span title="The Cycle of Rice and War Module" class="module-icon ml-2">🌾</span></p>
                            </section>
                            <hr class="section-divider">
                            <section id="s8">
                                <h2 class="!mt-0" id="s8_heading"><span class="rule-number">§ 8</span>Victory & Defeat</h2>
                                <h3 class="mt-16" id="s8_1"><span class="rule-number">§ 8.1</span>Vassalage</h3>
                                <p>The instant your final Daimyō is removed, you become a vassal of the player who defeated it.</p>
                                <h4 class="mt-16" id="s8_1_1"><span class="rule-number">§ 8.1.1</span>Consequences</h4>
                                <ul class="list-disc list-inside">
                                    <li>Immediately lose half of your provinces and troops (your choice).</li>
                                    <li>A vassal cannot win the game but retains their clan ability.</li>
                                    <li class="module-row">Upon becoming a Vassal, all existing Honor Pacts are immediately dissolved. A Vassal may not offer or accept new Honor Pacts until they are liberated.<span title="Political Play Module" class="module-icon ml-2">⚖️</span></li>
                                </ul>
                                <h4 class="mt-16" id="s8_1_2"><span class="rule-number">§ 8.1.2</span>Paths to Liberation</h4>
                                <ol class="list-decimal list-inside">
                                    <li><strong>Gekokujō Assault:</strong> For one round, spend all Koku to hire twice as many Ronin (1 Koku = 2 Ronin). You are liberated if you defeat any free clan's last Daimyō.</li>
                                    <li><strong>Rebuilding:</strong> Deposit up to 3 Koku per round into a "Liberation Fund." You are liberated when the fund reaches 10 Koku.</li>
                                </ol>
                                <p class="mt-4 italic text-gray-400">★ This rule is replaced by the \*\*Path of Glory\*\* module (<a href="#s10_4" class="nav-link-inline">§10.4</a>).<span title="Path of Glory Module" class="module-icon ml-2">🏆</span></p>
                                <h3 class="mt-16" id="s8_2"><span class="rule-number">§ 8.2</span>Player Elimination</h3>
                                <p>A player is eliminated if they lose their last province while having no Daimyō on the board.</p>
                                <p class="mt-4">A player with zero provinces is not eliminated as long as they have at least one Daimyō on the board. On their turn, they continue to collect their base income of 3 Koku and may take actions as normal. This Daimyō exists in a contested, neutral province and must win a battle to reclaim territory—a difficult but not impossible path back into the conflict.</p>
                            </section>
                            <hr class="section-divider">
                            <section id="s9">
                                <h2 class="!mt-0" id="s9_heading"><span class="rule-number">§ 9</span>Advanced Rules</h2>
                                <h3 class="mt-16" id="s9_1"><span class="rule-number">§ 9.1</span>The Ninja System</h3>
                                <p>Hire the Ninja for 3 Koku. Choose a public Field Operation or a covert Assassination. A Field Operation must be declared and its target province announced immediately after the Ninja is hired during your Reinforcement turn.</p>
                                <div class="table-responsive-wrapper">
                                    <table>
                                        <thead><tr><th data-label="Type">Mission Type</th><th data-label="Sub-Type">Sub-Type</th><th data-label="Effect">Effect</th></tr></thead>
                                        <tbody>
                                            <tr><td data-label="Type"><strong>Field Operation</strong></td><td data-label="Sub-Type">Sabotage</td><td data-label="Effect">-1 on defense rolls and no recruitment in a province for the round.</td></tr>
                                            <tr><td data-label="Type"></td><td data-label="Sub-Type">Diversion</td><td data-label="Effect">The target province cannot be attacked for the round. This ability cannot target a Mandate Province if there is a player currently on the 'Path of Glory.'</td></tr>
                                            <tr><td data-label="Type"><strong>Assassination</strong></td><td data-label="Sub-Type">Assassination</td><td data-label="Effect">At the start of a combat, you may reveal your hidden Ninja to remove one enemy Bushi from the battle. This ability cannot be used if the targeted Bushi is in the same province as one of its clan's Daimyō.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <h3 class="mt-16" id="s9_2"><span class="rule-number">§ 9.2</span>Castle & Fortress Construction</h3>
                                <ul class="list-disc list-inside">
                                    <li><strong>Build Castle (5 Koku):</strong> Place a castle in a province you control. Provides +1 on defense rolls. Limit 1 per player.</li>
                                    <li><strong>Fortify Castle (3 Koku):</strong> Place a marker on your castle. Increases its defense bonus to +2 for one round.</li>
                                </ul>
                            </section>
                        </div>
                    </div>
                </section>
                `,
                'modules': `
                <section id="page-modules" class="page-container">
                    <div class="py-12 px-4"><div class="max-w-4xl mx-auto"><section id="s10_modules">
                        <header>
                            <h2 class="!mt-0" id="s10_heading"><span class="rule-number">§ 10</span>OPTIONAL MODULES</h2>
                        </header>
                        <h3 class="mt-16" id="s10_1"><span class="rule-number">§ 10.1</span>Module: Political Play & Diplomacy<span title="Political Play Module" class="module-icon ml-2">⚖️</span></h3>
                        <blockquote><strong>Complexity Assessment:</strong> Rules: Low | Depth: Medium | Playtime: Low<br><strong>In a Nutshell:</strong> Adds negotiation & betrayal.</blockquote>
                        <p><strong>Design Philosophy:</strong> This module poses a new strategic question: "Is the short-term benefit of an ally worth the long-term risk of betrayal?" It models the fragile, opportunistic alliances of the Sengoku Jidai, where pacts were tools, not bonds of friendship.</p>
                        <div class="info-card border-accent-secondary bg-gray-900/50">
                            <h4 class="!mt-0 !border-b-accent-secondary/50">The Central Dilemma: Ally or Isolate?</h4>
                            <p>This module forces a critical diplomatic decision each round.</p>
                            <ul class="list-none space-y-4 mt-4">
                                <li class="flex">
                                    <span class="mr-4 text-accent-secondary font-bold text-xl">🤝</span>
                                    <div><strong>FORGE AN ALLIANCE:</strong> Gain a temporary shield for your shared border and coordinate attacks.<br><span class="text-sm text-gray-400">Benefit: Increased security and offensive potential. Risk: Your ally may betray you, or their presence could block your victory.</span></div>
                                </li>
                                <li class="flex">
                                    <span class="mr-4 text-accent-secondary font-bold text-xl">👤</span>
                                    <div><strong>TRUST NO ONE:</strong> Maintain absolute strategic freedom to attack anyone at any time.<br><span class="text-sm text-gray-400">Benefit: Unpredictability and total autonomy. Risk: You face all enemies alone, with no one to guard your flank.</span></div>
                                </li>
                            </ul>
                        </div>
                        <h4 class="mt-16" id="s10_1_1"><span class="rule-number">§ 10.1.1</span>Honor Pact System</h4>
                        <ul class="list-disc list-inside">
                            <li><strong>Offer:</strong> In the Planning Phase, pay 1 Koku to propose a pact for the current round.</li>
                        </ul>
                        <h4 class="mt-16" id="s10_1_2"><span class="rule-number">§ 10.1.2</span>Pact Consequences</h4>
                        <ul class="list-disc list-inside">
                            <li><strong>Joint Defense:</strong> Allies may occupy the same province.</li>
                            <li><strong>Combined Stacking:</strong> When allied units occupy the same province, each allied player may have up to 7 of their own units in the province, provided the combined total of all allied units does not exceed 10.</li>
                            <li><strong>Breach of Honor:</strong> If you attack your ally, your units get a -1 penalty on attack rolls for the rest of the round.</li>
                        </ul>
                        <h4 class="mt-16" id="s10_1_3"><span class="rule-number">§ 10.1.3</span>Combat With Allies</h4>
                        <p>If a province with allied units is attacked, the attacker decides how to split their hits between the allied players.</p>
                        <h3 class="mt-16" id="s10_2"><span class="rule-number">§ 10.2</span>Module: Specialized Warfare<span title="Specialized Warfare Module" class="module-icon ml-2">🛡️</span></h3>
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
                        <h4 class="mt-16" id="s10_2_1"><span class="rule-number">§ 10.2.1</span>Expansion: Technological Change<span title="Specialized Warfare Module" class="module-icon ml-2">🛡️</span></h4>
                        <p>Adds the "Ashigaru Arquebusiers" unit and a "Firearm Phase" before the Ranged Phase.</p>
                        <div class="table-responsive-wrapper">
                            <table class="table-structured">
                                <thead><tr><th data-label="Unit">Unit</th><th data-label="Attack">Attack (d6)</th><th data-label="Defense">Defense (d6)</th><th data-label="Special">Special</th></tr></thead>
                                <tbody>
                                    <tr><td data-label="Unit"><strong>Ashigaru Arquebusiers</strong></td><td data-label="Attack">4-6 (Firearm)</td><td data-label="Defense">-</td><td data-label="Special"><strong>Volley:</strong> Ignores castle defense bonus.</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <h3 class="mt-16" id="s10_3"><span class="rule-number">§ 10.3</span>Module: The Cycle of Rice and War<span title="The Cycle of Rice and War Module" class="module-icon ml-2">🌾</span></h3>
                        <blockquote><strong>Complexity Assessment:</strong> Rules: High | Depth: High | Playtime: Medium<br><strong>In a Nutshell:</strong> Introduces deep economic planning, risk, and raiding.</blockquote>
                        <p><strong>Design Philosophy:</strong> This module introduces a profound strategic trilemma by making your treasury vulnerable. In the core game, saving Koku is always a safe option. With this module, unmanaged wealth is lost to \*\*Spoilage\*\*. You must now actively choose how to protect your resources for the future.</p>
                        <div class="info-card border-accent-secondary bg-gray-900/50">
                            <h4 class="!mt-0 !border-b-accent-secondary/50">The Central Dilemma: Spend, Sow, or Store?</h4>
                            <p>This module forces a critical decision at the start of each round. Any Koku not spent on your army must be allocated:</p>
                            <ul class="list-none space-y-4 mt-4">
                                <li class="flex">
                                    <span class="mr-4 text-accent-secondary font-bold text-xl">⚔️</span>
                                    <div><strong>SPEND:</strong> Use Koku for immediate military power (recruitment, castles).<br><span class="text-sm text-gray-400">Benefit: Maximum tempo. Risk: No future economic growth.</span></div>
                                </li>
                                <li class="flex">
                                    <span class="mr-4 text-accent-secondary font-bold text-xl">🌾</span>
                                    <div><strong>SOW:</strong> Invest Koku on provinces for a high return.<br><span class="text-sm text-gray-400">Benefit: Highest potential reward. Risk: Vulnerable to Raiding and bad Harvests.</span></div>
                                </li>
                                <li class="flex">
                                    <span class="mr-4 text-accent-secondary font-bold text-xl">🏯</span>
                                    <div><strong>STORE:</strong> Place Koku in your granaries, safe from Spoilage.<br><span class="text-sm text-gray-400">Benefit: Absolute security. Risk: Zero growth; the Koku is unavailable for the round.</span></div>
                                </li>
                            </ul>
                        </div>
                        <p class="mt-8"><strong>This module replaces the standard Winter rule (<a href="#s7_heading" class="nav-link-inline">§7</a>) and adds a new combat rule for Raiding (<a href="#s6_2_7" class="nav-link-inline">§6.2.7</a>).</strong></p>
                        <h4 class="mt-16" id="s10_3_1"><span class="rule-number">§ 10.3.1</span>Modified Round Structure</h4>
                        <ul class="list-disc list-inside space-y-4">
                            <li><strong>Phase 1: Planning & Reinforcement</strong>
                                <ul class="list-disc list-inside ml-4">
                                    <li>
                                        <strong>Step 0: Sowing & Storing (New Step)</strong>
                                        <p class="!mt-2">After all players have received their income, they must decide the fate of their treasury. In player order, each player performs one or both of the following actions with any amount of their unspent Koku:</p>
                                        <ol class="list-decimal list-inside ml-4 mt-2">
                                            <li><strong>Sow in Provinces:</strong> Place Koku tokens from your treasury directly onto one or more provinces you currently control. This is a high-risk investment, vulnerable to Raiding.</li>
                                            <li><strong>Store in Granaries:</strong> Announce you are "Storing Rice." This action allows you to carry Koku securely into the next round, protecting it from Spoilage. You simply keep these Koku coins behind your player screen. They cannot be Sown in the same round they are Stored.</li>
                                        </ol>
                                    </li>
                                </ul>
                            </li>
                            <li><strong>Phase 3: Winter (Replaces standard Winter Phase)</strong>
                                <ul class="list-disc list-inside ml-4">
                                    <li>
                                        <strong>Step 1: Determine Harvest</strong>
                                        <p class="!mt-2">One player rolls a single d6. The result determines the harvest yield for all players this round:</p>
                                        <ul class="list-disc list-inside ml-4 mt-2">
                                            <li><strong>1-2 (Famine):</strong> Harvest yields 1 Koku for every 1 Koku Sown.</li>
                                            <li><strong>3-5 (Normal):</strong> Harvest yields 2 Koku for every 1 Koku Sown.</li>
                                            <li><strong>6 (Bountiful):</strong> Harvest yields 3 Koku for every 1 Koku Sown.</li>
                                        </ul>
                                    </li>
                                    <li><strong>Step 2: Harvest</strong> - For each province you still control that has invested Koku on it, receive the harvest yield and return the Sown Koku to the general supply.</li>
                                    <li><strong>Step 3: Supply (Replaces §4.1 Upkeep)</strong> - Pay Upkeep for all your Bushi and any supply costs for units in mountain provinces.</li>
                                    <li><strong>Step 4: Spoilage (New Step)</strong> - At the very end of the round, any Koku remaining in a player's active treasury (not Sown or Stored from a previous round) is subject to spoilage. Each player must discard half of their remaining Koku, rounded down. Koku gained from the Harvest step is immediately added to your active treasury and is subject to Spoilage at the end of the current round.</li>
                                </ul>
                            </li>
                        </ul>
                        <div class="info-card border-accent-secondary bg-gray-900">
                            <h4 class="!mt-0">Warning: High Complexity Combination</h4>
                            <p>Combining <strong>The Cycle of Rice and War</strong> <span title="The Cycle of Rice and War Module" class="module-icon">🌾</span> with <strong>Specialized Warfare</strong> <span title="Specialized Warfare Module" class="module-icon">🛡️</span> is recommended for expert players only. This pairing creates a deep, logistical wargame that requires managing both a complex economy and a granular combat system simultaneously.</p>
                        </div>
                        <h3 class="mt-16" id="s10_4"><span class="rule-number">§ 10.4</span>Module: Path of Glory<span title="Path of Glory Module" class="module-icon ml-2">🏆</span></h3>
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
                        <p class="mt-8"><strong>Replaces the Vassalage rule (<a href="#s8_1" class="nav-link-inline">§8.1</a>).</strong> A player whose last Daimyō is defeated collects Glory Points (GP). Win immediately upon reaching 7 GP.</p>
                        <div class="table-responsive-wrapper">
                            <table><thead><tr><th data-label="Condition">Condition</th><th data-label="GP">GP Earned</th></tr></thead><tbody><tr><td data-label="Condition">Defeat any player's last Daimyō.</td><td data-label="GP">+2 GP</td></tr><tr><td data-label="Condition">Defeat the leading player's last Daimyō.</td><td data-label="GP">+3 GP</td></tr><tr><td data-label="Condition">Gain sole control of a mandate province.</td><td data-label="GP">+3 GP</td></tr></tbody></table>
                        </div>
                    </section></div></div>
                </section>
                `,
                'strategy': `
                <section id="page-strategy" class="page-container">
                    <div class="py-12 px-4"><div class="max-w-4xl mx-auto">
                        <header>
                            <h2 class="!mt-0" id="s8_heading">The Art of War: A Strategic Primer</h2>
                        </header>
                        <section>
                            <p>This section moves beyond the "how" of the rules and into the "why" of expert play. To master Shogun: Gekokujō is to understand its interlocking systems not as a set of restrictions, but as a training ground for strategic thought. This guide provides a didactic path, from grasping the game's fundamental truths to executing multi-layered grand strategy, all through the lens of history's greatest military minds.</p>
                            <hr class="section-divider">
                            <h2 id="s8_journeyman">The Journeyman's Path: Mastering the Foundations</h2>
                            <p>Before one can command, one must understand the unyielding terrain of war. These are the four pillars of this world, the fundamental truths upon which all strategies are built or broken. Each is a lesson in causation, grounded in the timeless principles of Sun Tzu's \*Art of War\*.</p>
                            <div class="info-card">
                                <h3 class="!mt-0" id="s8_1_1">Pillar 1: The Economic Engine</h3>
                                <p><strong>The Mechanic:</strong> Armies have an ongoing Upkeep cost (§4.1), paid every round after income is collected.</p>
                                <p><strong>The Strategic Principle (Sun Tzu):</strong> "The general who wins a battle makes many calculations in his temple ere the battle is fought." Victory is a function of superior administration and pre-conflict calculation. Conflict is an economic undertaking.</p>
                                <p><strong>The Historical Lesson:</strong> A campaign is a logistical undertaking before it is a military one. Armies do not materialize on the battlefield; they are products of a state's economic capacity. An army that outstrips its supply lines will starve long before it is defeated.</p>
                                <p><strong>Application in Gekokujō:</strong> Every conquest must be profitable. If you conquer three provinces (+3 Koku income) but require eight new Bushi to hold them (+4 Koku upkeep), you have become strategically poorer. Before every action, ask the guiding question: <strong>Can my economy sustain this operation?</strong></p>
                                <blockquote class="module-row">
                                    <h4 class="!mt-0 !border-b-accent-primary/50">Module Consideration: The Cycle of Rice and War <span class="module-icon">🌾</span></h4>
                                    <p>This module fundamentally changes the economic pillar. The passive act of saving Koku is no longer safe due to \*\*Spoilage\*\*. The new guiding question becomes a trilemma: "Should I \*\*Spend\*\* for immediate power, \*\*Sow\*\* for high-risk growth, or \*\*Store\*\* for long-term security?" Your treasury is no longer a bank; it is a resource that must be actively managed or lost.</p>
                                </blockquote>
                            </div>
                            <div class="info-card">
                                <h3 class="!mt-0" id="s8_1_2">Pillar 2: The Gekokujō Principle</h3>
                                <p><strong>The Mechanic:</strong> The player with the fewest provinces acts first in a round (§4.1).</p>
                                <p><strong>The Strategic Principle (Sun Tzu):</strong> "He who is skilled in creating momentum rolls round logs or stones down a hill." A strategist must distinguish between static strength (the number of provinces) and dynamic potential (the ability to act decisively).</p>
                                <p><strong>The Historical Lesson:</strong> The Sengoku Jidai was defined by Gekokujō - "the low overthrow the high." Power was not a birthright; it was a function of momentum and initiative. A larger domain was a greater target, its ruler burdened by predictability, while a smaller, ambitious clan could strike with speed and surprise.</p>
                                <p><strong>The Strategic Application:</strong> Initiative is a resource. A tactical withdrawal is not a defeat; it is a calculated sacrifice of territory ('space') to seize the initiative ('tempo'). Ask the guiding question: <strong>Is losing this province worth gaining the first move next round?</strong> This is the application of the \*36 Stratagems' #36: If All Else Fails, Retreat.\*</p>
                            </div>
                            <div class="info-card">
                                <h3 class="!mt-0" id="s8_1_3">Pillar 3: Irreplaceable Leadership</h3>
                                <p><strong>The Mechanic:</strong> You begin with three Daimyō and can never recruit more (§2.3).</p>
                                <p><strong>The Strategic Principle (Sun Tzu):</strong> "If you know the enemy and know yourself, you need not fear the result of a hundred battles." Knowing yourself means understanding your critical vulnerabilities.</p>
                                <p><strong>The Historical Lesson:</strong> An army's effectiveness is tied to its command. The loss of a leader like Takeda Shingen or Uesugi Kenshin was not just the loss of a single man; it was a blow to the morale, structure, and tactical genius of their entire clan, from which they might never recover.</p>
                                <p><strong>The Strategic Application:</strong> Your Daimyō are your clan's center of gravity. Their preservation is your primary military objective. A specific application of this is \*The 36 Stratagems' #18: Defeat the Enemy by Capturing Their Chief.\* Ask the guiding question: <strong>Is the tactical advantage I gain from this move worth the risk to my leadership?</strong></p>
                            </div>
                            <div class="info-card">
                                <h3 class="!mt-0" id="s8_1_4">Pillar 4: The Logistics of Geography</h3>
                                <p><strong>The Mechanic:</strong> Armies in mountain provinces incur significant supply costs during Winter (§7.1).</p>
                                <p><strong>The Strategic Principle (Sun Tzu):</strong> "The natural formation of the country is the soldier's best ally." A wise general does not fight against the terrain; they use it to amplify their own strengths and exploit the enemy's weaknesses.</p>
                                <p><strong>The Historical Lesson:</strong> Mountains are natural fortresses but logistical nightmares. An army could defend a mountain pass with few men, but supplying that army through the winter could bankrupt a clan.</p>
                                <p><strong>The Strategic Application:</strong> Use geography as a weapon. For most clans, mountains are a temporary shield, not a sustainable empire. Lure enemies into them before winter, letting attrition become your ally, an application of \*The 36 Stratagems' #16: In Order to Capture, One Must Let Go.\* You must ask: <strong>Can I afford to hold this mountain through the winter, or should I use it as a temporary trap?</strong></p>
                            </div>
                            <hr class="section-divider">
                            <h2 id="s8_commander">The Commander's Path: Operational Art & The 36 Stratagems</h2>
                            <p>With the foundations mastered, a commander learns to apply them. This is the art of operations—the use of engagements for the purpose of the war. While Sun Tzu provides the philosophy, the \*Thirty-Six Stratagems\* provide a playbook of specific, often deceptive, tactical maneuvers.</p>
                            <div class="info-card">
                                <h3 class="!mt-0" id="s8_2_1">On Deception and Misdirection</h3>
                                <p><strong>The Principle (Sun Tzu):</strong> <em>"All warfare is based on deception. Hence, when able to attack, we must seem unable."</em></p>
                                <p><strong>The Maneuver (Stratagem #6):</strong> <em>"Make a Sound in the East, then Strike in the West."</em> This is the classic feint. Focus the enemy's attention on a credible but false threat to achieve surprise elsewhere.</p>
                                <p><strong>Application in Gekokujō:</strong> Hire the Ninja for a "Province Sabotage" (§9.1) on a northern province. This is your "sound in the east." After your opponent repositions forces to counter the public threat, use your Campaign phase to make your real attack, seizing the key southern province they left vulnerable.</p>
                            </div>
                            <div class="info-card">
                                <h3 class="!mt-0" id="s8_2_2">On Asymmetrical Warfare</h3>
                                <p><strong>The Principle (Sun Tzu):</strong> <em>"The supreme art of war is to subdue the enemy without fighting."</em> The most efficient victory is one where the enemy's will to fight is broken before the battle begins.</p>
                                <p><strong>The Maneuver (Stratagem #19):</strong> <em>"Remove the Firewood from Under the Cauldron."</em> This stratagem teaches that the primary target is not the enemy army, but its economic base. An army that cannot pay its upkeep will collapse. Both Sun Tzu's principle and this stratagem share the core idea of indirect attack against an opponent's source of strength.</p>
                                <p><strong>Application in Gekokujō:</strong> This is the fundamental strategy against a militarily superior but economically overextended foe. Do not fight the Oda clan's armies head-on; capture their economic provinces. Without Koku, they cannot afford the upkeep (§4.1) on their large armies. You win by making it impossible for them to continue the war.</p>
                                <blockquote class="module-row">
                                    <h4 class="!mt-0 !border-b-accent-primary/50">Module Consideration: The Cycle of Rice and War <span class="module-icon">🌾</span></h4>
                                    <p>This module provides the ultimate expression of this stratagem. \*\*Raiding (§6.2.7)\*\* allows you to physically seize an opponent's invested Koku from the board, directly removing the "firewood" from their economic engine and adding it to your own.</p>
                                </blockquote>
                            </div>
                            <hr class="section-divider">
                            <h2 id="s8_interlude">Historical Interlude: The Three Great Unifiers</h2>
                            <blockquote class="border-accent-secondary">
                                <p>The game you are playing is a reflection of the ambitions and failures of real historical figures. Understanding their paths is to understand the soul of this game.</p>
                                <p><strong>Oda Nobunaga (The Demon King):</strong> Nobunaga was a revolutionary. He embraced new technologies (firearms) and ruthless tactics. His clan ability, <strong>The Shogun's Vanguard</strong>, reflects this aggressive, leader-led doctrine. To play the Oda is to walk his path: high-risk, high-reward assaults that rely on the direct presence of your leadership to break the enemy.</p>
                                <p><strong>Toyotomi Hideyoshi (The Taikō):</strong> Hideyoshi was the ultimate Gekokujō story. He rose from a peasant sandal-bearer to the ruler of all Japan. He was a master of logistics, diplomacy, and siege warfare. The \*\*Path of Glory\*\* module (§10.4) is a direct homage to his journey—a player who has lost everything can still achieve victory not through territory, but through legendary, giant-slaying feats.</p>
                                <p><strong>Tokugawa Ieyasu (The Shōgun):</strong> Ieyasu was a master of patience and strategic resilience. He outlasted all his rivals, consolidating his power base and waiting for his enemies to exhaust themselves. His immunity to mountain attrition reflects his historical stronghold in the mountainous Kanto region. To play the Tokugawa is to embrace his philosophy: build an unshakeable foundation, practice patience, and win the long war.</p>
                            </blockquote>
                            <hr class="section-divider">
                            <h2 id="s8_master">The Master's Path: Grand Strategy & Synthesis</h2>
                            <p>A master does not view the game's systems in isolation, but forges them into new weapons. This is the art of synthesis—understanding how modules interact, how player count dictates strategy, and how to execute a decisive, game-winning turn.</p>
                            <div class="info-card">
                                <h3 class="!mt-0" id="s8_3_1">On Module Synergy</h3>
                                <p>Modules are not mere additions; they are multipliers that create new strategic dilemmas.</p>
                                <ul class="list-disc list-inside space-y-2">
                                    <li><strong>The Diplomat's Trap (Political Play + Mandate Victory):</strong> Your ally helps you conquer Kyōto. You now control all three mandate provinces but cannot win because their troops are present (§1.3). The pact that enabled your conquest has become the trap that prevents your victory. This is a perfect setup for \*Stratagem #24: Obtain Safe Passage to Conquer the State of Guo.\*</li>
                                    <li><strong>The Logistical Nightmare (The Cycle of Rice and War + Specialized Warfare):</strong> This combination transforms the game into a deep logistical simulation. The expensive, elite units of Specialized Warfare require the long-term economic planning of The Cycle of Rice and War. Failure to perfectly balance your Sowing and Storing of rice (§10.3) with your recruitment of costly Samurai will lead to swift bankruptcy.</li>
                                </ul>
                            </div>
                            <div class="info-card">
                                <h3 class="!mt-0" id="s8_3_2">Case Study: The Decisive Sacrifice</h3>
                                <p><strong>The Scenario:</strong> The Takeda, in second place, face the superior army of the leading Oda clan. A direct battle would be a costly defeat.</p>
                                <p><strong>The Master's Move:</strong> Instead of reinforcing, the Takeda player moves their army \*away\* from the border, completely abandoning the province. The Oda player walks in without a fight. This is a direct execution of \*Stratagem #36: If All Else Fails, Retreat.\*</p>
                                <p><strong>The Strategic Victory:</strong> By losing a province, Takeda ensures they will act first in the next round (Gekokujō Principle). On their turn, they use this initiative to launch a devastating attack on a different, weaker part of the Oda empire. By refusing a tactical battle they were likely to lose, they created the conditions for a strategic victory. They traded space for tempo.</p>
                            </div>
                        </section>
                        <hr class="section-divider">
                        <section id="s8_clans_guide">
                            <h2 class="!mt-0">Strategy Guide to the Clans</h2>
                            <details class="bg-gray-800 p-4 rounded-lg mb-4">
                                <summary class="cursor-pointer font-semibold text-xl">A Commander's Guide to the Great Clans</summary>
                                <div class="mt-6 space-y-6">
                                    
                                    <!-- Chosokabe -->
                                    <details class="bg-gray-900 p-4 rounded-lg">
                                        <summary class="cursor-pointer font-semibold">The Chosokabe Clan (Economist)</summary>
                                        <div class="mt-4">
                                            <h4 class="!mt-0 !border-b-0">Thematic Ability: "Island Economy"</h4>
                                            <p><strong>Ability:</strong> Your base income is 4 Koku (instead of 3). Additionally, you gain +1 Koku for every 2 coastal provinces you control (max +2 Koku per round).</p>
                                            <h4 class="mt-6">How to Play the Chosokabe</h4>
                                            <ul class="list-disc list-inside space-y-2">
                                                <li><strong>Compound Your Income:</strong> You start with an economic advantage. A priority should be to secure two coastal provinces to max out your ability. This income advantage is significant.</li>
                                                <li><strong>Build Tall:</strong> Use your superior income to build Castles and recruit larger armies. You can play more defensively early, building a strong position on Tosa while your economy grows.</li>
                                                <li><strong>Overwhelm with Numbers:</strong> In the mid-to-late game, use your economic advantage to field a large army with upkeep costs that would be difficult for other clans to sustain.</li>
                                            </ul>
                                            <h4 class="mt-6">How to Counter the Chosokabe</h4>
                                            <ul class="list-disc list-inside space-y-2">
                                                <li><strong>Attack Early:</strong> The Chosokabe's advantage is economic and requires time to translate into military force. An aggressive early attack can weaken them before their economy is fully developed.</li>
                                                <li><strong>Military Superiority:</strong> The Chosokabe have no combat bonuses. A clan like the Oda or a Daimyō-led Takeda army can defeat a Chosokabe force of equal or slightly greater size. Use tactical advantages to overcome their numbers.</li>
                                                <li><strong>Disrupt their Coast:</strong> The Chosokabe rely on coastal provinces to maximize their income. Seizing one of their key coastal territories can slow their economic growth.</li>
                                            </ul>
                                        </div>
                                    </details>

                                    <!-- Hojo -->
                                    <details class="bg-gray-900 p-4 rounded-lg">
                                        <summary class="cursor-pointer font-semibold">The Hōjō Clan (Builder)</summary>
                                        <div class="mt-4">
                                            <h4 class="!mt-0 !border-b-0">Thematic Ability: "The Unbreakable Wall"</h4>
                                            <p><strong>Ability:</strong> The cost to build your Fortress is 3 Koku. Its defense bonus is +2 (instead of +1). If your Fortress is destroyed, you may rebuild it.</p>
                                            <h4 class="mt-6">How to Play the Hōjō</h4>
                                            <ul class="list-disc list-inside space-y-2">
                                                <li><strong>Build the Fortress Early:</strong> Spending 3 Koku to build your Fortress in Sagami in an early round is a primary objective.</li>
                                                <li><strong>The Central Bastion:</strong> Once built, your Fortress province becomes an anchor for your territories. You can hold it with a smaller force due to the +2 defense bonus, freeing up your main armies to operate elsewhere.</li>
                                                <li><strong>Control the Center:</strong> Your home province, Sagami (Edo), is one of the three Mandate Provinces. This makes achieving the Shogun's Mandate victory a viable path. Secure your fortress, then use it as a base to attack and seize Kyoto and Osaka.</li>
                                            </ul>
                                            <h4 class="mt-6">How to Counter the Hōjō</h4>
                                            <ul class="list-disc list-inside space-y-2">
                                                <li><strong>Ignore the Fortress:</strong> Do not commit large armies to attacking the Hōjō fortress. The +2 defense bonus creates a significant statistical disadvantage for the attacker. Focus on conquering other provinces to win.</li>
                                                <li><strong>Isolate and Contain:</strong> The Hōjō's power is static and tied to their fortress. Capture the provinces around their fortress to limit their income and expansion.</li>
                                                <li><strong>Specialized Warfare Module:</strong> If using this module, the Ashigaru Arquebusiers unit is an effective counter. Its "Volley" ability allows it to ignore the castle defense bonus, making the Fortress less effective.</li>
                                            </ul>
                                        </div>
                                    </details>
                                    
                                    <!-- Mori -->
                                    <details class="bg-gray-900 p-4 rounded-lg">
                                        <summary class="cursor-pointer font-semibold">The Mōri Clan (Naval Power)</summary>
                                        <div class="mt-4">
                                            <h4 class="!mt-0 !border-b-0">Thematic Ability: "Masters of the Inland Sea"</h4>
                                            <p><strong>Ability:</strong> Movement between two Mōri-controlled provinces that border the same sea zone costs only 1 movement point, even if they share no land border. Additionally, you gain +1 Koku for every 3 coastal provinces you control.</p>
                                            <h4 class="mt-6">How to Play the Mōri</h4>
                                            <ul class="list-disc list-inside space-y-2">
                                                <li><strong>Create a Coastal Empire:</strong> Your primary goal is to control a string of coastal provinces. This fuels your economy and creates the logistical network for your ability.</li>
                                                <li><strong>Strategic Redeployment:</strong> Your greatest strength is surprising your enemies. If an opponent masses troops on one border, you can move your entire army by sea to an undefended flank in a single turn.</li>
                                                <li><strong>Control the Mandate:</strong> The Mandate provinces of Settsu (Osaka) and Sagami (Edo) are both coastal. Your ability makes you well-suited to launch naval invasions to seize them.</li>
                                            </ul>
                                            <h4 class="mt-6">How to Counter the Mōri</h4>
                                            <ul class="list-disc list-inside space-y-2">
                                                <li><strong>Break the Chain:</strong> The Mōri ability relies on controlling a continuous chain of coastal provinces. Capturing a single key province in their network can cut their sea connection and limit their mobility.</li>
                                                <li><strong>Landlock Them:</strong> Identify the key land provinces that connect the Mōri's coastal holdings to the rest of the map and fortify them. If they can't break out from the coast, their naval power is restricted.</li>
                                                <li><strong>Predict their Target:</strong> A Mōri player will look for valuable, undefended coastal provinces. Anticipate this and prepare a counter-attack. Leave a province looking vulnerable, but have a relief force ready to move in.</li>
                                            </ul>
                                        </div>
                                    </details>

                                    <!-- Oda -->
                                    <details class="bg-gray-900 p-4 rounded-lg">
                                        <summary class="cursor-pointer font-semibold">The Oda Clan (Aggressor)</summary>
                                        <div class="mt-4">
                                            <h4 class="!mt-0 !border-b-0">Thematic Ability: "The Shogun's Vanguard"</h4>
                                            <p><strong>Ability:</strong> If an Oda Daimyō is present, all attacking Oda units in that battle receive a +1 bonus to their attack rolls.</p>
                                            <h4 class="mt-6">How to Play the Oda</h4>
                                            <ul class="list-disc list-inside space-y-2">
                                                <li><strong>Utilise Daimyō in Combat:</strong> Your Daimyō are important military assets. Use them in important assaults, as the +1 attack bonus increases the combat effectiveness of your Bushi.</li>
                                                <li><strong>Early Military Action:</strong> The Oda have no inherent economic bonuses. A viable strategy is to attack a neighbour early to weaken them and acquire provinces before their economy is fully developed.</li>
                                                <li><strong>Focus on Mandate Provinces:</strong> The Oda ability is well-suited for seizing the three Mandate Provinces, as the attack bonus helps to overcome defensive advantages like castles.</li>
                                            </ul>
                                            <h4 class="mt-6">How to Counter the Oda</h4>
                                            <ul class="list-disc list-inside space-y-2">
                                                <li><strong>Target the Daimyō:</strong> The Oda's military advantage is tied to their Daimyō. Use a Ninja to remove a Bushi guarding a Daimyō, or use a feint to lure their main army away and then attack the exposed leader. Without a Daimyō present, their ability does not apply.</li>
                                                <li><strong>Economic Warfare:</strong> An Oda player may need to attack frequently to support their economy. Avoid engaging their main army and instead attack their less-defended economic provinces. An Oda army with insufficient Koku for upkeep will be forced to remove units.</li>
                                                <li><strong>Avoid Decisive Battles:</strong> The Oda player benefits from large, decisive battles where their bonus can be maximised. Employ smaller-scale attacks, retreat from their main army, and force them to spread their units out. An Oda army that cannot engage in favourable battles has a less efficient economy.</li>
                                            </ul>
                                        </div>
                                    </details>
                                    
                                    <!-- Otomo -->
                                    <details class="bg-gray-900 p-4 rounded-lg">
                                        <summary class="cursor-pointer font-semibold">The Otomo Clan (Gambler)</summary>
                                        <div class="mt-4">
                                            <h4 class="!mt-0 !border-b-0">Thematic Ability: "Nanban Trade"</h4>
                                            <p><strong>Ability:</strong> When you declare an attack, you may spend 2 Koku before any dice are rolled. If you do, you may re-roll all of your failed attack rolls for your Bushi units in that battle.</p>
                                            <h4 class="mt-6">How to Play the Otomo</h4>
                                            <ul class="list-disc list-inside space-y-2">
                                                <li><strong>Conserve Koku:</strong> Your ability is expensive and cannot be used in every battle. Play conservatively, build your treasury, and identify a single battle that will have a major impact on the game.</li>
                                                <li><strong>The Decisive Battle:</strong> The best time to use your ability is when attacking a high-value target (a Mandate Province, an enemy Daimyō, a fortress) where the odds are otherwise unfavourable.</li>
                                                <li><strong>Psychological Pressure:</strong> The threat of your ability can be a weapon. Opponents may become more cautious or over-commit defenders to provinces, creating opportunities for you elsewhere.</li>
                                            </ul>
                                            <h4 class="mt-6">How to Counter the Otomo</h4>
                                            <ul class="list-disc list-inside space-y-2">
                                                <li><strong>Drain their Treasury:</strong> The Otomo player needs Koku to use their ability. Force them into small, insignificant battles. They must choose between spending 2 Koku on a minor fight, or risk losing and having their treasury reduced.</li>
                                                <li><strong>Force them to Defend:</strong> Their ability only works when attacking. If you can force the Otomo to be the defender, their ability is unusable.</li>
                                                <li><strong>Bait the Trap:</strong> Let them attack a province that seems important but isn't critical to your plans. Let them spend their 2 Koku to win it. You have traded a piece of land for their most valuable resource, leaving them vulnerable to a counter-attack while their treasury is empty.</li>
                                            </ul>
                                        </div>
                                    </details>

                                    <!-- Shimazu -->
                                    <details class="bg-gray-900 p-4 rounded-lg">
                                        <summary class="cursor-pointer font-semibold">The Shimazu Clan (Expansionist)</summary>
                                        <div class="mt-4">
                                            <h4 class="!mt-0 !border-b-0">Thematic Ability: "Masters of the Western Seas"</h4>
                                            <p><strong>Ability:</strong> +1 Koku per coastal province you control (max +3 per round).</p>
                                            <h4 class="mt-6">How to Play the Shimazu</h4>
                                            <ul class="list-disc list-inside space-y-2">
                                                <li><strong>Dominate the Coast:</strong> In the first few rounds, a key goal is to capture three coastal provinces. This will max out your ability and give you a Koku advantage over most other clans.</li>
                                                <li><strong>Create a Snowball Effect:</strong> Reinvest your extra income immediately into more Bushi. Leverage your economic advantage into a military one.</li>
                                                <li><strong>Island Fortress:</strong> Your starting position in Satsuma is relatively isolated and difficult for central clans to attack early. Use this to build your power base before invading the mainland.</li>
                                            </ul>
                                            <h4 class="mt-6">How to Counter the Shimazu</h4>
                                            <ul class="list-disc list-inside space-y-2">
                                                <li><strong>Deny the Coast:</strong> Contest coastal provinces with the Shimazu player early. Forcing them to spend troops and Koku fighting for those provinces slows their economic engine.</li>
                                                <li><strong>Early Attack:</strong> A Shimazu player's position can feel secure. A surprise attack from a neighbouring clan (like the Otomo or Mori) can weaken them before their economy fully develops.</li>
                                                <li><strong>Outlast Them:</strong> The Shimazu bonus caps at +3. A clan with a stronger late-game economy or military ability can often weather the initial Shimazu expansion and overpower them in later rounds.</li>
                                            </ul>
                                        </div>
                                    </details>

                                    <!-- Takeda -->
                                    <details class="bg-gray-900 p-4 rounded-lg">
                                        <summary class="cursor-pointer font-semibold">The Takeda Clan (Mobile Force)</summary>
                                        <div class="mt-4">
                                            <h4 class="!mt-0 !border-b-0">Thematic Ability: "The Wind of Kai"</h4>
                                            <p><strong>Ability:</strong> When a Takeda Daimyō moves, up to 6 Bushi from the same starting province may move with him as a single group, using the Daimyō's movement of 3.</p>
                                            <h4 class="mt-6">How to Play the Takeda</h4>
                                            <ul class="list-disc list-inside space-y-2">
                                                <li><strong>Threaten Multiple Fronts:</strong> Your speed is a key asset. Position your main army in a central location from which it can strike in multiple directions. This can force an opponent to defend a wider area, potentially spreading their forces thin.</li>
                                                <li><strong>The Decisive Strike:</strong> Assemble a strong force under a single Daimyō and use its 3-province movement to bypass enemy screening forces and attack a critical, lightly-defended target, such as a Mandate province or an economic centre.</li>
                                                <li><strong>Mobile Warfare:</strong> You don't need to hold every province. Use your speed to raid enemy territories, forcing them to respond, and then move away before they can engage your main force.</li>
                                            </ul>
                                            <h4 class="mt-6">How to Counter the Takeda</h4>
                                            <ul class="list-disc list-inside space-y-2">
                                                <li><strong>Screen and Block:</strong> The Takeda army must end its move upon entering an enemy province. Use single Bushi units to create a screen, forcing their main army to stop and fight, which prevents them from executing a deep strike into your territory.</li>
                                                <li><strong>Static Defense:</strong> Fortifications like Castles are effective against the Takeda. Their ability grants mobility, not additional combat strength. A well-defended province can make their attacks costly.</li>
                                                <li><strong>Counter-Attack the Homeland:</strong> The Takeda's military power is often concentrated in a single large army. When that army goes on a long-range campaign, it can leave their home provinces vulnerable.</li>
                                            </ul>
                                        </div>
                                    </details>

                                    <!-- Tokugawa -->
                                    <details class="bg-gray-900 p-4 rounded-lg">
                                        <summary class="cursor-pointer font-semibold">The Tokugawa Clan (Turtle)</summary>
                                        <div class="mt-4">
                                            <h4 class="!mt-0 !border-b-0">Thematic Ability: "Masters of the Mountains"</h4>
                                            <p><strong>Ability:</strong> Immune to supply costs in mountain provinces.</p>
                                            <h4 class="mt-6">How to Play the Tokugawa</h4>
                                            <ul class="list-disc list-inside space-y-2">
                                                <li><strong>Secure the Highlands:</strong> Occupying mountain provinces is an early priority. This creates a defensive core that is easy for you to supply and presents a logistical challenge for your enemies, especially in Winter.</li>
                                                <li><strong>Focus on the Late Game:</strong> A rapid early victory is less likely. Focus on building a strong economy and a large army. The goal is to be in a superior position in the late game when others may be overextended.</li>
                                                <li><strong>Use the Winter Phase:</strong> While other clans pay supply costs for mountain armies, you do not. This allows you to maintain forces in forward mountain passes, preparing for offensives while enemies may need to withdraw units or pay significant costs.</li>
                                            </ul>
                                            <h4 class="mt-6">How to Counter the Tokugawa</h4>
                                            <ul class="list-disc list-inside space-y-2">
                                                <li><strong>Deny Mountain Access:</strong> Prevent the Tokugawa player from consolidating their mountain power base. Contest these provinces early to slow their economic development, even if holding them long-term is not feasible.</li>
                                                <li><strong>Expand Elsewhere:</strong> Avoid costly attacks against their fortified mountain positions. While they build strength, expand across the coastal and central plains. Pursue a Province Control or Shogun's Mandate victory before their strategy fully develops.</li>
                                                <li><strong>Naval Pressure:</strong> Tokugawa's starting area is landlocked. A clan with naval mobility (e.g., Mōri, Shimazu) can often bypass their mountain defenses and attack their coastal territories.</li>
                                            </ul>
                                        </div>
                                    </details>

                                    <!-- Uesugi -->
                                    <details class="bg-gray-900 p-4 rounded-lg">
                                        <summary class="cursor-pointer font-semibold">The Uesugi Clan (Defender)</summary>
                                        <div class="mt-4">
                                            <h4 class="!mt-0 !border-b-0">Thematic Ability: "The Dragon's Domain"</h4>
                                            <p><strong>Ability:</strong> Any Uesugi unit defending in a province under your control at the start of this round receives a +1 bonus to its defense rolls.</p>
                                            <h4 class="mt-6">How to Play the Uesugi</h4>
                                            <ul class="list-disc list-inside space-y-2">
                                                <li><strong>Establish a Defensive Front:</strong> Your ability only works in provinces you controlled at the start of the round. Identify key strategic chokepoints and fortify them. A province with your defensive bonus and a Castle is a very difficult position to attack.</li>
                                                <li><strong>Calculated Offense:</strong> While the bonus is defensive, it facilitates an offensive strategy of sequential conquest. Conquer a province, hold it for a round to activate your bonus, and then use that secure base to launch your next strike.</li>
                                                <li><strong>Economic Advantage through Attrition:</strong> Inflict high casualties on attacking armies while preserving your own. While opponents spend Koku replacing losses, you can invest in your economy.</li>
                                            </ul>
                                            <h4 class="mt-6">How to Counter the Uesugi</h4>
                                            <ul class="list-disc list-inside space-y-2">
                                                <li><strong>Avoid Attacking Their Strength:</strong> The Uesugi player benefits when you attack their fortified positions. Expand around them and force them to attack you, as their ability is useless on offense.</li>
                                                <li><strong>Feints and Misdirection:</strong> The Uesugi defense is only active in provinces they already hold. Threaten one province to make them commit forces, then attack a different, newly conquered, and therefore vulnerable, territory.</li>
                                                <li><strong>The Ninja's Sabotage:</strong> The Ninja is an effective tool against the Uesugi. A Sabotage mission will inflict a -1 penalty to their defense rolls, neutralizing their clan ability for a round.</li>
                                            </ul>
                                        </div>
                                    </details>
                                </div>
                            </details>
                        </section>
                    </div></div>
                </section>
                `,
                'timing': `
                <section id="page-timing" class="page-container">
                    <div class="py-12 px-4"><div class="max-w-4xl mx-auto">
                        <header>
                            <h2 class="!mt-0" id="timing_heading">Detailed Timing & Action Structure</h2>
                        </header>
                        <section>
                            <p>This document provides a granular, step-by-step breakdown of the game's sequences to eliminate ambiguity and serve as a definitive reference for procedural questions during play.</p>
                            <div class="table-responsive-wrapper">
                                <h3 class="!border-b-0 !text-center !mb-0" id="timing_round_structure">Part 1: The Round Timing Structure</h3>
                                <table class="table-structured">
                                    <thead><tr><th data-label="Step">Step</th><th data-label="Action">Action</th><th data-label="Notes">Player(s) & Notes</th></tr></thead>
                                    <tbody>
                                        <tr class="module-row"><td colspan="3" class="text-center font-bold">1.0. Phase 1: Planning & Reinforcement</td></tr>
                                        <tr><td data-label="Step"><strong>1.1</strong></td><td data-label="Action"><strong>Income & Administration Step</strong></td><td data-label="Notes"><strong>Simultaneous</strong></td></tr>
                                        <tr><td data-label="Step"></td><td data-label="Action" class="pl-12">1.1.1. Collect Income (<a href="#s4_1" class="nav-link-inline">§4.1</a>)</td><td data-label="Notes">Add 3 Koku + 1 Koku per province.</td></tr>
                                        <tr class="module-row"><td data-label="Step"></td><td data-label="Action" class="pl-12">Sowing Step (<a href="#s10_3" class="nav-link-inline">§10.3</a>) <span title="The Cycle of Rice and War Module" class="module-icon">🌾</span></td><td data-label="Notes"><strong>Module Only:</strong> "Cycle of Rice & War". Players invest Koku.</td></tr>
                                        <tr><td data-label="Step"></td><td data-label="Action" class="pl-12">1.1.2. Pay Upkeep (<a href="#s4_1" class="nav-link-inline">§4.1</a>)</td><td data-label="Notes">Pay 1 Koku per 2 Bushi. (Skipped if using "Cycle of Rice & War").</td></tr>
                                        <tr><td data-label="Step"></td><td data-label="Action" class="pl-12">1.1.3. Determine Player Order (<a href="#s4_1" class="nav-link-inline">§4.1</a>)</td><td data-label="Notes">Fewest provinces go first.</td></tr>
                                        <tr><td data-label="Step"><strong>1.2</strong></td><td data-label="Action"><strong>Vassal Decision Point</strong></td><td data-label="Notes"><strong>Vassals Only</strong> (Replaced by "Path of Glory" module).</td></tr>
                                        <tr><td data-label="Step"></td><td data-label="Action" class="pl-12">1.2.1. Choose Path to Liberation (<a href="#s8_1_2" class="nav-link-inline">§8.1.2</a>)</td><td data-label="Notes">Binding choice for the round.</td></tr>
                                        <tr><td data-label="Step"><strong>1.3</strong></td><td data-label="Action"><strong>Recruitment & Construction Step</strong></td><td data-label="Notes"><strong>In Player Order</strong></td></tr>
                                        <tr><td data-label="Step"></td><td data-label="Action" class="pl-12">1.3.1. First player recruits/builds.</td><td data-label="Notes">Continues sequentially.</td></tr>
                                        <tr class="module-row"><td data-label="Step"><strong>1.3a</strong></td><td data-label="Action"><strong>Diplomacy Step</strong> <span title="Political Play Module" class="module-icon">⚖️</span></td><td data-label="Notes"><strong>Module Only:</strong> "Political Play"</td></tr>
                                        <tr class="module-row"><td data-label="Step"></td><td data-label="Action" class="pl-12">1.3a.1. Offer/Accept Honor Pacts (<a href="#s10_1" class="nav-link-inline">§10.1</a>)</td><td data-label="Notes">Performed sequentially in player order.</td></tr>
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
                                        <tr><td data-label="Step"><strong>3.1</strong></td><td data-label="Action"><strong>Supply Step</strong></td><td data-label="Notes"><strong>Simultaneous</strong> (Replaced by "Cycle of Rice & War").</td></tr>
                                        <tr class="module-row"><td data-label="Step"><strong>3.1a</strong></td><td data-label="Action"><strong>Harvest Step</strong> <span title="The Cycle of Rice and War Module" class="module-icon">🌾</span></td><td data-label="Notes"><strong>Module Only:</strong> "Cycle of Rice & War"</td></tr>
                                        <tr class="module-row"><td data-label="Step"></td><td data-label="Action" class="pl-12">Receive Koku from Sowing (<a href="#s10_3" class="nav-link-inline">§10.3</a>).</td><td data-label="Notes"></td></tr>
                                        <tr class="module-row"><td data-label="Step"><strong>3.1b</strong></td><td data-label="Action"><strong>Module Supply Step</strong> <span title="The Cycle of Rice and War Module" class="module-icon">🌾</span></td><td data-label="Notes"><strong>Module Only:</strong> "Cycle of Rice & War"</td></tr>
                                        <tr class="module-row"><td data-label="Step"></td><td data-label="Action" class="pl-12">Pay Upkeep & Mountain Costs (<a href="#s10_3" class="nav-link-inline">§10.3</a>).</td><td data-label="Notes"></td></tr>
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
                                    <tr class="module-row"><td data-label="Step"><strong>4.0</strong></td><td data-label="Action"><strong>Firearm Phase</strong> <span title="Specialized Warfare Module" class="module-icon">🛡️</span></td><td data-label="Notes"><strong>Module Only:</strong> "Technological Change"</td></tr>
                                    <tr class="module-row"><td data-label="Step"></td><td data-label="Action" class="pl-12">4.1. Arquebusiers fire and resolve hits.</td><td data-label="Notes"></td></tr>
                                    <tr><td data-label="Step"><strong>5.0</strong></td><td data-label="Action"><strong>Melee Phase</strong></td><td data-label="Notes"></td></tr>
                                    <tr><td data-label="Step"></td><td data-label="Action" class="pl-12">5.1. All sides determine total hits.</td><td data-label="Notes"></td></tr>
                                    <tr><td data-label="Step"></td><td data-label="Action" class="pl-12">5.2. All sides assign hits.</td><td data-label="Notes"></td></tr>
                                    <tr><td data-label="Step"></td><td data-label="Action" class="pl-12">5.3. All marked units are removed simultaneously.</td><td data-label="Notes"></td></tr>
                                    <tr><td data-label="Step"><strong>6.0</strong></td><td data-label="Action"><strong>Conclude Combat</strong></td><td data-label="Notes">Remove Ronin, resolve Raiding (<a href="#s6_2_7" class="nav-link-inline">§6.2.7</a>).</td></tr>
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
                                            <li><strong>Income & Administration (Simultaneous):</strong> Receive income, pay upkeep (skip on turn 1), determine player order (Gekokujō).</li>
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
                                            <li><strong>Supply (Simultaneous):</strong> Pay supply costs for units in mountain provinces. <span title="The Cycle of Rice and War Module" class="module-icon">🌾</span></li>
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
                                            <tr><td data-label="Action"><strong>Upkeep</strong></td><td data-label="Cost/Yield">-1 Koku per 2 Bushi (rounded up)</td><td data-label="When">Phase 1.1 (Skipped on Turn 1)</td></tr>
                                            <tr><td data-label="Action"><strong>Recruitment</strong></td><td data-label="Cost/Yield">-1 Koku per Bushi</td><td data-label="When">Phase 1.2</td></tr>
                                            <tr class="module-row"><td data-label="Action"><strong>Winter Supply</strong> <span title="The Cycle of Rice and War Module" class="module-icon">🌾</span></td><td data-label="Cost/Yield">-1 Koku per Mountain Province + -1 Koku per 3 units there</td><td data-label="When">Phase 3 (Replaced by Module)</td></tr>
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
                                <p>These provinces incur extra supply costs during the Winter phase (unless you are Tokugawa).</p>
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
                                            <tr><td data-label="Module"><strong>The Cycle of Rice and War</strong> <span title="The Cycle of Rice and War Module" class="module-icon">🌾</span></td><td data-label="Changes">Standard Winter & Upkeep in Phase 1</td><td data-label="Adds">Provincial Investment, Harvest Events, Raiding, Storing Rice, Spoilage.</td></tr>
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
                                <li><strong>Control:</strong> You are the only player with units in a province at the end of a phase.</li>
                                <li><strong>Daimyō:</strong> Your three irreplaceable leader units. They are powerful in combat but cannot be recruited again if lost.</li>
                                <li><strong>Defender:</strong> The player whose province is being entered by an attacker's units.</li>
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
                                <li><strong>Supply Costs:</strong> The Koku paid during the Winter phase for controlling mountain provinces and for the units stationed within them.</li>
                                <li><strong>Upkeep:</strong> The cost in Koku required at the start of each round to maintain your army of Bushi.</li>
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
                            <p>We honor this process by treating this document as a "living rulebook." It is built to adapt and grow, incorporating the collective wisdom of its community to achieve a state of perfect elegance and balance. Every game you play is a playtest, and every piece of feedback you share is a contribution to this shared project.</p>
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
    };

    if (!window.shogunRulebookInitialized) {
        init();
        window.shogunRulebookInitialized = true;
    }
});



