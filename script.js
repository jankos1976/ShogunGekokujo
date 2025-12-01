document.addEventListener('DOMContentLoaded', () => {
    'use strict';

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

        // CRITICAL CHECK
        if (!appWrapper) {
            console.error("Critical Error: Element with ID 'app-wrapper' not found in index.html.");
            return;
        }

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
                    clone.querySelector('body').classList.remove('light-mode');
                    const toc = clone.querySelector('#toc-container');
                    if (toc) toc.classList.remove('is-expanded');
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

            if (appWrapper && tocContainer) {
                const isTocExpanded = tocContainer.classList.contains('is-expanded');
                appWrapper.style.paddingLeft = isContentPage && window.innerWidth >= 1024 ?
                    (isTocExpanded ? 'var(--toc-width-expanded)' : 'var(--toc-width-collapsed)') :
                    '0';
            }

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
            const btn = getEl('back-to-top');
            if (btn) {
                window.addEventListener('scroll', throttle(() => {
                    btn.style.display = window.scrollY > 400 ? 'flex' : 'none'
                }, 200), { passive: true });
                btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
            }

            const glossaryList = getEl('glossary-list');
            if (!glossaryList) return;

            const terms = {};
            glossaryList.querySelectorAll('li').forEach(item => {
                const termEl = item.querySelector('strong');
                if (termEl) {
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
                        if (activeModules.has(moduleData)) {
                            show = true;
                        }
                    } else {
                        if (!activeModules.has(replacedByData)) {
                            show = true;
                        }
                    }

                    if (row.querySelector('th')) {
                        show = true;
                    }

                    row.style.display = show ? '' : 'none';
                });
            };

            toggles.forEach(toggle => {
                toggle.addEventListener('change', updateTimingTable);
            });

            updateTimingTable();
        };

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
                        const isVisible = searchTerm === '' || text.includes(searchTerm);
                        li.classList.toggle('hidden', !isVisible);
                        if (isVisible) {
                            visibleCount++;
                        }
                    });

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

            toggleTOC(false);
        };

        const initResponsiveTables = () => {
            document.querySelectorAll('.table-responsive-wrapper').forEach(wrapper => {
                const table = wrapper.querySelector('table');
                if (!table) return;

                const checkScrollable = (wrapper, table) => {
                    if (!wrapper.classList.contains('card-view-active')) {
                        setTimeout(() => {
                            const isScrollable = table.scrollWidth > wrapper.clientWidth + 2;
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
                                <p class="text-lg mt-2">Rulebook v89 (Living Rulebook - Gold Master)</p>
                            </header>
                            <section>
                                <h3 class="mt-16">A Manual for the Sengoku Jidai</h3>
                                <p>This document presents a modernization of the 1986 Milton Bradley title "Shogun." It attempts to correct the structural flaws of the original design while retaining its nostalgic appeal. We have replaced the randomness of dice with the certainty of logistical constraints. You are invited to manage this economy; whether this qualifies as "fun" or "work" is for you to decide.</p>
                                <p>It is a medium-heavy simulation of economic management, military conquest, and fragile alliances. It assumes that you are interested in a game where supply lines matter as much as swordplay.</p>
                                <div class="info-card">
                                    <h3 class="!mt-0">Scope of the Game</h3>
                                    <ul class="list-none space-y-4">
                                        <li><strong class="text-green-400">IS:</strong> A 2-3 hour exercise in logistics and positioning.</li>
                                        <li><strong class="text-green-400">IS:</strong> An attempt to capture the desperation of the Sengoku period.</li>
                                        <li><strong class="text-red-400">IS NOT:</strong> An all-day spectacle. It respects your time.</li>
                                        <li><strong class="text-red-400">IS NOT:</strong> An asymmetric faction game. The clans differ in efficiency, not rules.</li>
                                    </ul>
                                </div>
                                <div class="info-card">
                                    <h3 class="!mt-0">The Four Pillars of Power</h3>
                                    <ol class="list-none space-y-4">
                                        <li><strong>1. The Gekokujō Principle:</strong> Weakness grants initiative. The fewer provinces you hold, the earlier you act.</li>
                                        <li><strong>2. Economic Reality:</strong> Armies require maintenance. A large force without income is a liability.</li>
                                        <li><strong>3. Finite Leadership:</strong> You begin with 3 Daimyō. You will never receive more. Protect them.</li>
                                        <li><strong>4. Geography Costs:</strong> Mountains are defensible but economically draining. Do not hold them without cause.</li>
                                    </ol>
                                </div>
                                <div class="info-card">
                    <h3 class="!mt-0">Parameters</h3>
                    <ul class="list-none space-y-4">
                        <li><strong class="text-accent-secondary">👥 Players:</strong> 4-5. Fewer is unbalanced; more is impossible.</li>
                        <li><strong class="text-accent-secondary">⏳ Playtime:</strong> 2-4 hours. Depends on analysis paralysis.</li>
                        <li><strong class="text-accent-secondary">🎂 Age:</strong> 14+. Requires patience and arithmetic.</li>
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
                                    <summary class="cursor-pointer font-semibold">Major Evolution: v81 to v89</summary>
                                    <div class="mt-4">
                                        <p class="mb-4">Since v81, <em>Shogun: Gekokujō</em> has undergone a significant evolution to sharpen its strategic edge and deepen player interaction. These are the most impactful changes:</p>
                                        <ul class="list-disc list-inside space-y-4">
                                            <li>
                                                <strong>1. The Clandestine System (Ninja Rework - §9.1):</strong><br>
                                                <span class="text-gray-400">Old (v81):</span> A passive purchase for a static buff.<br>
                                                <span class="text-accent-primary">New (v89):</span> An active "trap" mechanic. The Ninja is placed openly on the board. It triggers powerful reactions (<strong>"Deny Passage!"</strong>, <strong>"Sow Discord!"</strong>, <strong>"Burn the Supplies!"</strong>) only when an opponent moves into or fights in that province. This creates a zone of psychological denial.
                                            </li>
                                            <li>
                                                <strong>2. Vassalage "Civil War" (Anti-Doomstack Fix - §8.1):</strong><br>
                                                <span class="text-gray-400">Old (v81):</span> A vassal simply lost half their lands/troops.<br>
                                                <span class="text-accent-primary">New (v89):</span> When a Liege Lord claims a vassal's province, only <strong>up to 3 units</strong> switch sides. Any remaining units stay loyal to the vassal. If units from more than one player remain, the province becomes <strong>Contested</strong> (no income). This prevents the winner from instantly inheriting a massive, game-breaking army.
                                            </li>
                                            <li>
                                                <strong>3. Vassal "Choice by Deeds" (§8.3):</strong><br>
                                                <span class="text-gray-400">Old (v81):</span> Vassals chose their path (Loyalty vs. Betrayal) in a bureaucratic phase.<br>
                                                <span class="text-accent-primary">New (v89):</span> The path is chosen by <strong>action</strong>. The first target you attack determines your alignment for the round. Attack the Lord? Betrayal. Attack anyone else? Loyalty. Zero downtime, maximum drama.
                                            </li>
                                            <li>
                                                <strong>4. "Blood Feud" Politics (§10.1):</strong><br>
                                                <span class="text-gray-400">Old (v81):</span> Breaking an alliance cost a small combat penalty.<br>
                                                <span class="text-accent-primary">New (v89):</span> Alliances now require a <strong>Koku Pledge</strong> (deposit). Betrayal means forfeiting your deposit to the victim and triggering a permanent <strong>Blood Feud</strong>, granting the victim lasting combat bonuses against you. Treachery is now expensive and dangerous.
                                            </li>
                                            <li>
                                                <strong>5. Integrated Nanban Trade (§10.6):</strong><br>
                                                <span class="text-gray-400">Old (v81):</span> A standalone rule for a random dice ability.<br>
                                                <span class="text-accent-primary">New (v89):</span> Fully integrated into the <strong>Specialized Warfare</strong> module. Paying for the technology now unlocks the specific <strong>Arquebusier</strong> unit type, which ignores castle defenses. This makes firearms a tangible part of your army composition.
                                            </li>
                                            <li>
                                                <strong>6. Refined Terminology:</strong><br>
                                                <span class="text-gray-400">Old (v81):</span> "Honor" (Kyoto currency) confused players with "Honor Pacts".<br>
                                                <span class="text-accent-primary">New (v89):</span> The currency for controlling Kyoto is now <strong>"Legitimacy"</strong> (§10.7), clearly distinguishing political clout from diplomatic agreements.
                                            </li>
                                        </ul>
                                    </div>
                                </details>
                            </section>
                            <hr class="section-divider">
                            <section id="veteran-changes">
                                <h2 class="!mt-0">For Veterans of the Original Game: What Has Changed?</h2>
                                <div class="pt-6">
                                    <p>If you've played the 1986 Milton Bradley classic *Shogun* (also known as *Samurai Swords* or *Ikusa*), you'll find the soul of the game intact, but the engine has been completely rebuilt. This version is designed to be a faster, more strategically focused euro-wargame. Here are the most impactful changes:</p>
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
                                <p>You are not out of the game. You become a Vassal.</p>
                                <ul class="list-disc list-inside">
                                    <li><strong>Immediately:</strong> You lose one province to your conqueror (your Liege Lord).</li>
                                    <li><strong>Your New Goal:</strong> You cannot win the game in this state, but you can regain your freedom.</li>
                                </ul>
                                <h4 class="mt-8">Your path is chosen by your deeds:</h4>
                                <ol class="list-decimal list-inside">
                                    <li><strong>Loyal Service:</strong> Attack your Lord's enemies. Earn "Kōseki" points to buy your freedom.</li>
                                    <li><strong>Betrayal:</strong> Attack your Lord directly. If you take a province, you are free. If you fail, you are eliminated.</li>
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
                        <h3 class="mt-8" id="s0_1"><span class="rule-number">§ 0.1</span>Rule of the Highest Source (Revised)</h3>
                            <p><strong>When multiple modifiers of the same type apply to a single action:</strong></p>
                                <ul class="list-disc list-inside ml-4">
                                <li>The single largest <strong>bonus</strong> of that type applies.</li>
                                <li>The single largest <strong>penalty</strong> of that type applies.</li>
                                <li>Bonuses and penalties of the same type are applied simultaneously and netted.</li>
                                </ul>
                                <p class="mt-4"><strong>Clarification:</strong> Types are defined by their effect target (e.g., "defense roll bonus", "attack roll bonus", "income bonus"). All bonuses to defense rolls are considered the same type, regardless of their source (clan ability, castle, terrain, etc.).</p> 
                        <h3 class="mt-8" id="s0_2"><span class="rule-number">§ 0.2</span>Module Rules Break Core Rules</h3>
                        <p><strong>The rule of an optional module always takes precedence over a core rule it directly contradicts.</strong></p>
                        <h3 class="mt-8" id="s0_3"><span class="rule-number">§ 0.3</span>Limited Components</h3>
                        <p>The number of game components (bushi, ronin, markers, etc.) is limited by the contents of the game. Once the general supply of a component is exhausted, no more of that type can be brought into play until some return to the supply.</p>
                        <h3 class="mt-8" id="s0_4"><span class="rule-number">§ 0.4</span>Core Definitions</h3>
<p>The following terms are used throughout these rules:</p>
<h4 class="mt-6">Province States:</h4>
<ul class="list-disc list-inside ml-4">
    <li><strong>Controlled Province:</strong> A province containing only units from a single player.</li>
    <li><strong>Contested Province:</strong> A province containing units from multiple players. A contested province yields no income.</li>
    <li><strong>Neutral Province:</strong> A province containing no units from any player.</li>
</ul>
<h4 class="mt-6">Control Types:</h4>
<ul class="list-disc list-inside ml-4">
    <li><strong>Sole Control:</strong> A province controlled by you with no allied units present (required for certain victory conditions and abilities).</li>
    <li><strong>Friendly Province:</strong> A province controlled by you or an ally (if an Honor Pact is active under §10.1).</li>
</ul>
<h4 class="mt-6">Unit States:</h4>
<ul class="list-disc list-inside ml-4">
    <li><strong>Active Units:</strong> Units that can still move and fight.</li>
    <li><strong>Marked Units:</strong> Units that have been assigned hits and will be removed at the end of the current combat step as casualties.</li>
</ul>
<h4 class="mt-6">Timing:</h4>
<ul class="list-disc list-inside ml-4">
    <li><strong>Start of Phase:</strong> The moment immediately after the previous phase ends, before any player actions.</li>
    <li><strong>End of Phase:</strong> The moment after all player actions in that phase are complete, before the victory check.</li>
    <li><strong>Simultaneously:</strong> All players perform the action at the same time, without a specific order.</li>
</ul>
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

<h3 class="mt-8" id="s3_2"><span class="rule-number">§ 3.2</span>Unit Limit per Province (Stacking Limit) - Revised</h3>
<p>A province can sustain a maximum of 7 units belonging to a single player.</p>
<p class="mt-4"><strong>Clarification:</strong></p>
<ul class="list-disc list-inside ml-4">
    <li>This limit applies to <strong>all unit types</strong> (Bushi, Daimyō, Ronin, Specialized Units from modules, etc.).</li>
    <li>The limit is checked after any game effect that changes unit count is fully resolved (recruitment, movement, combat, special abilities, etc.).</li>
</ul>
<p class="mt-4"><strong>Exception - Pass-Through Movement:</strong></p>
<p>Units may move through a province that already contains 7 of their own units. The stacking limit is checked before movement begins and after movement ends, but not during movement itself.</p>
<p class="mt-2">If a unit's movement is interrupted mid-transit (e.g., by a Ninja's "Deny Passage!" ability) and this causes a stacking violation, the owning player must immediately remove excess units of their choice until the limit is satisfied.</p>
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
        <p> A Daimyō is bound by their word and must meet their financial obligations. If a player is unable to pay a required cost (Unit Maintenance, Winter Mountain Provisions, etc.) at any time, they must immediately remove <strong>two</strong> of their Bushi units (player's choice) from the board for every 1 Koku they cannot pay. A clan cannot go into debt.</p>
        <p class="mt-4 italic">For example, if you are short 3 Koku, you must immediately remove 6 of your Bushi from the board.</p>
        <h3 class="mt-8" id="s4_3"><span class="rule-number">§ 4.3</span>Determine Player Order (GekokujÅ)</h3>
        <p> Only after all income and Unit Maintenance have been fully resolved, the player order for the round is determined. The player with the <strong>fewest provinces</strong> acts first. Ties are broken by: 1st - less Koku, 2nd - fewer total units, 3rd - clan name alphabetically.</li>
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

        <h3 class="mt-8" id="s5_2"><span class="rule-number">§ 5.2</span>Unit Placement</h3>
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
            <li>(Optional) <strong>Ninja Intervention:</strong> The Ninja player may reveal a mission (e.g., "Sow Discord!") if present.</li>
            <li><strong>Determine Hits:</strong> All units from all sides roll dice simultaneously to determine the number of hits they score.</li>
            <li><strong>Assign & Remove Casualties:</strong> This step follows a strict two-part sequence:
                <ul class="list-decimal list-inside ml-6 mt-2">
                    <li><strong>Part A: Assign Hits (Treffer zuweisen):</strong> All players who scored hits now assign them to one or more opposing players. This assignment happens sequentially, one player at a time:
                        <ul class="list-disc list-inside ml-6 mt-1">
                            <li>The <strong>Attacker</strong> assigns all their hits first.</li>
                            <li>Then, all <strong>Defenders</strong> assign all their hits, proceeding one defender at a time in clockwise order around the table (starting from the attacker's left).</li>
                            <li><em>(Clarification: A player may assign all their hits to a single opponent or split them among multiple opponents at their discretion).</em></li>
                        </ul>
                    </li>
                    <li><strong>Part B: Distribute Casualties & Remove Units:</strong> After all hits have been assigned in Part A, every player takes the total hits assigned to them and simultaneously distributes them as casualties to their own units (daimyō or bushi, at the player's discretion). All marked units are then removed from the board at the same time.</li>
                </ul>
            </li>
            <li><strong>Check for Control:</strong> If units from only one player remain, that player controls the province. If units from more than one player remain, or no units remain, the province becomes neutral.</li>
            <li>(Module) <strong>Raiding:</strong> If using module §10.3, the new controller seizes any invested Koku (see §6.2.7).</li>
        </ol>


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

        <h4 class="mt-6" id="s6_2_5"><span class="rule-number">§ 6.2.5</span>Example of Basic Combat</h4>
        <p>The Tokugawa player attacks a neutral province with 3 Bushi. It is defended by 2 Ronin hired by another player. No other modifiers are in play.</p>
        <ul class="list-disc list-inside">
            <li><strong>Tokugawa (Attacking):</strong> Rolls 3 dice for their 3 Bushi. An attack hits on a 5-6. They roll a 1, 4, and 5. This is <strong>1 hit</strong>.</li>
            <li><strong>Ronin (Defending):</strong> Rolls 2 dice for the 2 Ronin. A defense hits on a 6. They roll a 2 and 6. This is <strong>1 hit</strong>.</li>
            <li><strong>Resolving:</strong> Each side scored 1 hit. The Tokugawa player removes one Bushi, and the Ronin player removes one Ronin. The Tokugawa player now has 2 Bushi in the province, and the Ronin player has 1. The province remains contested.</li>
        </ul>

        <h4 class="mt-6" id="s6_2_6"><span class="rule-number">§ 6.2.6</span>Example of Combat with Modifiers</h4>
        <h5 class="mt-4" id="s6_2_6_1"><span class="rule-number">§ 6.2.6.1</span>Calculating Target Numbers</h5>
        <ul class="list-disc list-inside">
            <li><strong>Oda (Attacking):</strong> Oda Daimyō is present, so clan ability applies (+1). Daimyō hits on 3-6, Bushi on 4-6.</li>
            <li><strong>Uesugi (Defending):</strong> Uesugi has +1 from clan ability and +1 from the castle. Per Golden Rule §0.1, only one +1 bonus applies. Bushi hit on 5-6.</li>
        </ul>
        <h5 class="mt-4" id="s6_2_6_2"><span class="rule-number">§ 6.2.6.2</span>Rolling Dice & Resolving</h4>
        <p>Oda rolls for 1 Daimyō (3 dice) and 3 Bushi (3 dice), getting 4 hits total. Uesugi rolls for 4 Bushi (4 dice), getting 2 hits. Uesugi removes all 4 of their Bushi. Oda removes 2 Bushi. Oda now controls Echigo.</p>

        <h4 class="mt-6 module-row" id="s6_2_7"><span class="rule-number">§ 6.2.7</span>Raiding Invested Provinces <span title="The Cycle of Rice and War Module" class="module-icon">🌾</span></h4>
        <p><em>This rule is only in effect when using <strong>The Cycle of Rice and War</strong> module (<a href="#s10_3" class="nav-link-inline">§10.3</a>).</em></p>
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
        <p class="mt-4 italic text-gray-400">● This rule is replaced by <strong>The Cycle of Rice and War</strong> module (<a href="#s10_3" class="nav-link-inline">§10.3</a>).<span title="The Cycle of Rice and War Module" class="module-icon ml-2">🌾</span></p>

    </div>
</section>
<hr class="section-divider">
<section id="s8">
    <div class="info-card">
        <h2 class="!mt-0" id="s8_heading"><span class="rule-number">§ 8</span>Fealty (Vassalage)</h2>
        <p>The loss of the last Daimyō does not mean elimination from the game. It marks the transition from an independent clan to a vassal, an actor bound to a liege lord with a new, singular objective: to regain freedom.</p>

        <h3 class="mt-8" id="s8_1"><span class="rule-number">§ 8.1</span>Immediate Consequences</h3>
        <p>A single sword strike seals one's fate. The defeat is swift; the consequences are immediate and irreversible. The moment a player's last Daimyō is removed as a casualty from a battle, the following takes effect immediately:</p>
        <ul class="list-disc list-inside mt-4 space-y-3">
            <li>
                <strong>Determining the Liege Lord:</strong> The player who assigned the final casualty to the vassal's last Daimyō (see § 6.2.1, pt. 4a) becomes their <strong>Liege Lord</strong>.
            </li>
            <li>
                <strong>Province Loss and Troop Conversion:</strong> The <strong>Liege Lord</strong> immediately chooses one province controlled by the vassal.
                <ul class="list-disc list-inside ml-6 mt-2 space-y-2">
                    <li>The vassal loses this province to the <strong>Liege Lord</strong>.</li>
                    <li><strong>The loyalty of the garrison belongs to the land, not the man.</strong> Up to three of the vassal's units in this province swear fealty to the new Liege Lord. They are immediately replaced by an equal number of units from the Liege Lord's supply. Any remaining units stay in the province as loyalists to the vassal. If units from <strong>more than one</strong> player remain in the province, it becomes Contested and yields no income.</li>
                </ul>
            </li>
            <li>
                <strong>Vassal Status:</strong> A vassal can no longer win the game. However, they retain their clan ability and continue to participate in the game normally (Income, Recruitment, Movement). A vassal may attack any player and be attacked by any player.
            </li>
            <li>
                <strong>Automatic Liberation:</strong> The chain breaks if the chain-holder falls. Should a vassal's <strong>Liege Lord</strong> be eliminated from the game (lose their own last Daimyō), the vassal is immediately liberated at the end of that battle.
            </li>
        </ul>

        <h3 class="mt-8" id="s8_2"><span class="rule-number">§ 8.2</span>The Path to Liberation</h3>
        <p>The vassal is now bound to their Liege Lord. Their path to freedom is bought either through loyal service or bloody betrayal. A vassal has two paths to regain their freedom.</p>

        <div class="info-card mt-4">
            <h4 class="!mt-0">Path 1: Loyal Service</h4>
            <p>The vassal proves their utility and strength by fighting their Liege Lord's enemies—or earns their freedom through shrewd diplomacy.</p>
            <ul class="list-disc list-inside ml-4 mt-2 space-y-2">
                <li><strong>Objective:</strong> Collect 3 <strong>Kōseki</strong> (Merit Points).</li>
                <li><strong>Progress:</strong> Kōseki persist across rounds. Upon reaching 3 Kōseki, the vassal is liberated at the end of the phase.</li>
                <li><strong>Earning Points:</strong>
                    <ul class="list-disc list-inside ml-6 mt-1">
                        <li><strong>Conquest:</strong> For each province the vassal conquers (from another player or neutral), they receive 1 Kōseki.</li>
                        <li><strong>Negotiation:</strong> The Liege Lord may grant the vassal freedom (or Kōseki) at any time, typically in exchange for Koku, provinces, or military support.</li>
                    </ul>
                </li>
                <li><strong>Restriction:</strong> A vassal who chooses this path may not attack their Liege Lord during this round.</li>
            </ul>
        </div>

        <div class="info-card mt-4">
            <h4 class="!mt-0">Path 2: Betrayal (Open Rebellion)</h4>
            <p>The ultimate act of Gekokujō—the low overthrow the high. A single, successful dagger thrust washes away all shame, but failure means final death.</p>
            <ul class="list-disc list-inside ml-4 mt-2 space-y-2">
                <li><strong>Objective:</strong> Conquer at least one province from the Liege Lord.</li>
                <li><strong>Liberation:</strong> If successful, the vassal is immediately liberated at the end of combat.</li>
                <li><strong>The Consequence of Failure:</strong> If the vassal fails (i.e., they attack their Liege Lord this round but do not conquer a province from them), the vassal is <strong>ELIMINATED FROM THE GAME</strong> at the end of the phase.</li>
            </ul>
        </div>

        <h3 class="mt-8" id="s8_3"><span class="rule-number">§ 8.3</span>Choice by Deeds</h3>
        <p>A vassal is not defined by their words, but by their deeds. The first strike decides loyalty or rebellion.</p>
        <p>A vassal does not choose their path at the start of the round. Their <strong>first attack action</strong> in the Campaign Phase determines their binding path for the entire round:</p>
        <ul class="list-disc list-inside ml-4 mt-2">
            <li>If the vassal's first attack targets <strong>another player</strong> or a <strong>neutral province</strong>, they have chosen <strong>Path 1 (Loyal Service)</strong>.</li>
            <li>If the vassal's first attack targets their <strong>Liege Lord</strong>, they have chosen <strong>Path 2 (Betrayal)</strong>.</li>
        </ul>

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

        <h3 class="mt-8" id="s9_1"><span class="rule-number">§ 9.1</span>The Clandestine System (Ninja)</h3>
        <p>A Daimyō rules by his armies, but he wins by cunning. A Ninja is a weapon of the shadows, used to break the enemy's will, thwart their plans, and empty their coffers long before the first sword is drawn.</p>

        <h4 class="mt-6" id="s9_1_1"><span class="rule-number">§ 9.1.1</span>Hiring (The Price of Shadows)</h4>
        <ul class="list-disc list-inside space-y-2">
            <li><strong>Timing:</strong> During your Recruitment Phase (Phase 1b).</li>
            <li><strong>Cost:</strong> Pay <strong>3 Koku</strong> to the bank.</li>
            <li><strong>Placement:</strong> Place the single Ninja figure <strong>openly</strong> on any province on the map (own, enemy, or neutral).</li>
        </ul>
        <p class="mt-2">The Ninja's presence is now public knowledge. All players know an agent is operating in this province, but their true mission remains hidden.</p>

        <h4 class="mt-6" id="s9_1_2"><span class="rule-number">§ 9.1.2</span>Reveal (The Blade in the Dark)</h4>
        <p>The Ninja player may reveal the Ninja's mission <strong>once per round</strong> as soon as a valid trigger occurs in the Ninja's province.</p>
        <p>When a trigger occurs, the Ninja player may interrupt the triggering player's action and choose <strong>one</strong> of the three operations that matches the trigger. The specific mission is chosen at the moment of reveal.</p>
        <p>After the operation is revealed and its effect fully resolved, the Ninja figure is removed from the board for the rest of the round. Their contract is fulfilled.</p>

        <h4 class="mt-6" id="s9_1_3"><span class="rule-number">§ 9.1.3</span>The Three Operations</h4>
        <p>Each operation is designed to deliver strategic value equal to the 3 Koku investment.</p>

        <div class="info-card border-accent-secondary bg-gray-900/50 mt-4">
            <h5 class="!mt-0 !border-b-accent-secondary/50">1. "Deny Passage!" (The Iron Fan)</h5>
            <p><strong>Narrative:</strong> The agent renders marching routes impassable, fortifies passes, or threatens ambush, demanding a toll for safe passage.</p>
            <p><strong>Trigger:</strong> An opponent declares movement with one or more units <strong>into</strong> the province where the Ninja is stationed.</p>
            <p><strong>Effect:</strong> The Ninja's blade bars the way. The opponent faces a dilemma and must immediately choose:</p>
            <ul class="list-disc list-inside ml-4 mt-2">
                <li><strong>Option A (Break Through):</strong> Pay a flat fee of <strong>3 Koku</strong> to the bank to break the blockade and continue movement as planned.</li>
                <li><strong>Option B (Retreat):</strong> Immediately cancel the movement of this specific army into this province. The army remains in its province of origin (the province from which movement was declared). The army counts as having moved for this round and may take no further actions.</li>
            </ul>
        </div>

        <div class="info-card border-accent-secondary bg-gray-900/50 mt-4">
            <h5 class="!mt-0 !border-b-accent-secondary/50">2. "Sow Discord!" (The Poisoned Steel)</h5>
            <p><strong>Narrative:</strong> The agent sows fear and discord in the enemy ranks, poisons wells, or sabotages equipment, breaking morale before the first blow is struck.</p>
            <p><strong>Trigger:</strong> A battle begins <strong>in</strong> the Ninja's province (regardless of who is attacking or defending).</p>
            <p><strong>Effect:</strong> Immediately before dice are rolled, the Ninja player chooses one player involved in this battle. The agent disrupts the target's battle order: That player suffers a <strong>-1 penalty to all their die rolls</strong> (Attack or Defense) <strong>for this single battle</strong>.</p>
        </div>

        <div class="info-card border-accent-secondary bg-gray-900/50 mt-4">
            <h5 class="!mt-0 !border-b-accent-secondary/50">3. "Burn the Supplies!" (The Red Wind)</h5>
            <p><strong>Narrative:</strong> The agent infiltrates the camp and sets fire to rice stores and ammunition depots. The enemy must immediately spend resources to fight the fire and replace supplies—or watch their army starve.</p>
            <p><strong>Trigger:</strong> A battle begins <strong>in</strong> the Ninja's province (same trigger as "Sow Discord!").</p>
            <p><strong>Effect:</strong> Immediately before dice are rolled, the Ninja player chooses one player involved in this battle. The Ninja destroys the target's supply lines: That player must <strong>immediately pay 3 Koku</strong> to the bank.</p>
            <p><strong>Bankruptcy Clause:</strong> If the chosen player cannot pay the 3 Koku (or cannot pay it in full), the Bankruptcy Rule (§ 4.2) applies to the unpaid amount. The player must remove <strong>2 Bushi</strong> (of their choice, from anywhere on the board) for every 1 Koku they cannot pay.</p>
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
                    <div class="py-12 px-4"><div class="max-w-4xl mx-auto">
                        <header>
                           <h2 class="!mt-0" id="s10_heading"><span class="rule-number">§ 10</span>OPTIONAL MODULES</h2>
                        </header>
                        
                        <!-- § 10.0 Matrix -->
                        <div class="info-card border-accent-secondary bg-gray-900/50">
                            <h3 class="!mt-0 !border-b-accent-secondary/50" id="s10_0">§ 10.0 Guide to Modularity</h3>
                            <p>The following modules are designed as precise instruments to accentuate specific aspects of the game. Combining them should be done with intent.</p>
                            <h4 class="mt-8">Recommended Experience Packages</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                                <div class="info-card !m-0">
                                    <h5 class="!mt-0">The Age of Guns</h5>
                                    <p class="text-sm"><strong>Focus:</strong> Military & Technology</p>
                                    <p class="text-xs mt-2"><strong>Modules:</strong><br>§ 10.3 Specialized Warfare 🛡️<br>§ 10.4 The Nanban Trade 🔫</p>
                                </div>
                                <div class="info-card !m-0">
                                    <h5 class="!mt-0">The Price of the Empire</h5>
                                    <p class="text-sm"><strong>Focus:</strong> Economy & Instability</p>
                                    <p class="text-xs mt-2"><strong>Modules:</strong><br>§ 10.5 Cycle of Rice & War 🌾<br>§ 10.6 Ikkō-ikki Uprising 👺</p>
                                </div>
                                <div class="info-card !m-0">
                                    <h5 class="!mt-0">The Game for the Throne</h5>
                                    <p class="text-sm"><strong>Focus:</strong> Politics & Diplomacy</p>
                                    <p class="text-xs mt-2"><strong>Modules:</strong><br>§ 10.1 Political Play ⚖️<br>§ 10.2 The Emperor's Favor 👑</p>
                                </div>
                            </div>
                        </div>

                        <!-- SECTION A: POLITICS -->
                        <hr class="section-divider">
                        <h2 class="text-center text-accent-secondary">I. Politics & Diplomacy</h2>
                        
                        <!-- § 10.1 Political Play -->
                        <div class="info-card">
                            <h3 class="!mt-0" id="s10_1"><span class="rule-number">§ 10.1</span> Module: Political Play & Blood Feud<span title="Political Play & Blood Feud Module" class="module-icon ml-2">⚖️</span></h3>
                            <blockquote><strong>Complexity:</strong> Medium | <strong>Focus:</strong> Alliances & Betrayal</blockquote>
                            <h4 class="mt-8" id="s10_1_1"><span class="rule-number">§ 10.1.1</span> The Honor Pact</h4>
                            <p><strong>Cost:</strong> 1 Koku to offer. <strong>Pledge:</strong> Both players place 2 Koku in a shared pool.</p>
                            <ul class="list-disc list-inside mt-4 space-y-2">
                                <li><strong>Benefits:</strong> Move through ally's land. Share provinces (limit 10 units total).</li>
                                <li><strong>Betrayal (Attack Ally):</strong> Betrayer forfeits Pledge (Victim gets 4 Koku). Betrayer suffers <strong>-1 attack malus</strong> for the round.</li>
                                <li><strong>Blood Feud:</strong> Victim declares permanent Blood Feud (+1 Attack/Defense vs Betrayer forever).</li>
                            </ul>
                        </div>

                        <!-- § 10.2 Emperor's Favor -->
                        <div class="info-card">
                            <h3 class="!mt-0" id="s10_2"><span class="rule-number">§ 10.2</span>Module: The Emperor's Favor<span title="The Emperor's Favor Module" class="module-icon ml-2">👑</span></h3>
                            <blockquote><strong>Complexity:</strong> Low | <strong>Focus:</strong> King of the Hill (Kyoto)</blockquote>
                            <h4 class="mt-8" id="s10_2_1"><span class="rule-number">§ 10.2.1</span>Legitimacy</h4>
                            <p>Gain <strong>1 Legitimacy Point</strong> if you have sole control of Yamashiro (Kyoto) at the start of the Reinforcement Phase.</p>
                            <h4 class="mt-8" id="s10_2_2"><span class="rule-number">§ 10.2.2</span>Imperial Edicts</h4>
                            <p>Spend Legitimacy during your turn for effects:</p>
                            <ul class="list-disc list-inside">
                                <li><strong>3 Legitimacy (Legitimate Claim):</strong> Remove 3 enemy Bushi from one province (Owner gets 1 Koku/Bushi compensation).</li>
                                <li><strong>3 Legitimacy (Imperial Censure):</strong> Grant all players +1 Attack vs target player for this round.</li>
                                <li><strong>6 Legitimacy (Appointed Shogun):</strong> Immediate Victory if you control Kyoto.</li>
                            </ul>
                        </div>

                        <!-- SECTION B: WARFARE -->
                        <hr class="section-divider">
                        <h2 class="text-center text-accent-secondary">II. Warfare & Technology</h2>

                        <!-- § 10.3 Specialized Warfare -->
                        <div class="info-card">
                            <h3 class="!mt-0" id="s10_3"><span class="rule-number">§ 10.3</span>Module: Specialized Warfare<span title="Specialized Warfare Module" class="module-icon ml-2">🛡️</span></h3>
                            <blockquote><strong>Complexity:</strong> High | <strong>Focus:</strong> Tactical Rock-Paper-Scissors</blockquote>
                            <p>Replaces generic "Bushi" with specific unit types. Cost is 1 Koku per unit.</p>
                            <div class="table-responsive-wrapper">
                                <table class="table-structured">
                                    <thead><tr><th data-label="Unit">Unit</th><th data-label="Attack">Attack</th><th data-label="Defense">Defense</th><th data-label="Special">Special</th></tr></thead>
                                    <tbody>
                                        <tr><td data-label="Unit"><strong>Ashigaru Spearmen</strong></td><td data-label="Attack">6</td><td data-label="Defense">5-6</td><td data-label="Special"><strong>Spear Wall:</strong> +1 Def if ≥2 present.</td></tr>
                                        <tr><td data-label="Unit"><strong>Samurai Swordsmen</strong></td><td data-label="Attack">5-6</td><td data-label="Defense">5-6</td><td data-label="Special"><strong>Duelist:</strong> Rolls 2 dice if attacking alone.</td></tr>
                                        <tr><td data-label="Unit"><strong>Samurai Archers</strong></td><td data-label="Attack">4-6 (Ranged)</td><td data-label="Defense">6</td><td data-label="Special">Attacks in Ranged Phase (before Melee).</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- § 10.4 Nanban Trade -->
                        <div class="info-card">
                            <h3 class="!mt-0" id="s10_4"><span class="rule-number">§ 10.4</span>Module: The Nanban Trade<span title="The Nanban Trade & The Firearm Revolution Module" class="module-icon ml-2">🔫</span></h3>
                            <div class="info-card border-accent-primary bg-gray-900/50 mt-4"><p class="!mt-0 font-bold">REQUIRES § 10.3 Specialized Warfare</p></div>
                            <h4 class="mt-8" id="s10_4_1"><span class="rule-number">§ 10.4.1</span>Firearm Technology</h4>
                            <p>Control a Trading Post (Settsu or Hizen). Pay <strong>8 Koku</strong> once to unlock tech.</p>
                            <h4 class="mt-8" id="s10_4_3"><span class="rule-number">§ 10.4.3</span>Arquebusiers</h4>
                            <p><strong>Cost:</strong> 2 Koku per unit.</p>
                            <ul class="list-disc list-inside">
                                <li><strong>Attack:</strong> 4-6 (Firearm Phase - BEFORE Ranged).</li>
                                <li><strong>Defense:</strong> - (Cannot defend effectively, use as Bushi).</li>
                                <li><strong>Volley:</strong> Attacks ignore ALL Castle/Fortress defense bonuses.</li>
                            </ul>
                        </div>

                        <!-- SECTION C: ECONOMY -->
                        <hr class="section-divider">
                        <h2 class="text-center text-accent-secondary">III. Economy & Stability</h2>

                        <!-- § 10.5 Cycle of Rice & War -->
                        <div class="info-card">
                            <h3 class="!mt-0" id="s10_5"><span class="rule-number">§ 10.5</span>Module: The Cycle of Rice and War<span title="The Cycle of Rice and War Module" class="module-icon ml-2">🌾</span></h3>
                            <blockquote><strong>Complexity:</strong> High | <strong>Focus:</strong> Deep Logistics & Risk</blockquote>
                            <p><strong>Replaces:</strong> Standard Income & Winter Phase.</p>
                            
                            <h4 class="mt-8" id="s10_5_2"><span class="rule-number">§ 10.5.2</span>Modified Round Structure</h4>
                            <h5 class="mt-4">Phase 1: Planning</h5>
                            <ul class="list-disc list-inside">
                                <li><strong>Stipend:</strong> Fixed <strong>4 Koku</strong> per player (plus Clan Bonuses). No province income.</li>
                                <li><strong>Allocation:</strong> After spending, allocate ALL remaining Treasury Koku:
                                    <ul class="list-disc list-inside ml-4">
                                        <li><strong>Store:</strong> Safe for next round.</li>
                                        <li><strong>Sow:</strong> Place on province. <strong>Max 2 Koku per province.</strong> <strong>Cannot Sow in Mountains.</strong></li>
                                    </ul>
                                </li>
                            </ul>
                            
                            <h5 class="mt-4">Phase 3: Winter (Harvest)</h5>
                            <p>Roll <strong>2d6</strong> for global yield multiplier on Sown Koku:</p>
                            <ul class="list-disc list-inside ml-4">
                                <li><strong>2-5 (Famine):</strong> x1 Yield.</li>
                                <li><strong>6-9 (Normal):</strong> x2 Yield.</li>
                                <li><strong>10-12 (Bountiful):</strong> x3 Yield.</li>
                            </ul>
                            <p><strong>Spoilage:</strong> At phase end, discard <strong>half</strong> (rounded down) of Treasury Koku.</p>
                        </div>

                        <!-- § 10.6 Ikko-Ikki -->
                        <div class="info-card">
                            <h3 class="!mt-0" id="s10_6"><span class="rule-number">§ 10.6</span>Module: The Ikkō-ikki Uprising<span title="The Ikkō-ikki Uprising Module" class="module-icon ml-2">👺</span></h3>
                            <blockquote><strong>Complexity:</strong> Medium | <strong>Focus:</strong> Internal Friction</blockquote>
                            <ul class="list-disc list-inside mt-4">
                                <li><strong>Unrest:</strong> Losing a defense battle places an Unrest marker.</li>
                                <li><strong>Rebellion:</strong> A 2nd Unrest marker triggers Rebellion. Province becomes <strong>Neutral (Ikkō-ikki Stronghold)</strong> with 3 Neutral Bushi.</li>
                                <li><strong>Pacification:</strong> Pay 2 Koku to remove Unrest. Or reconquer and roll 4-6 to pacify.</li>
                            </ul>
                        </div>

                        <!-- SECTION D: THE FALLEN -->
                        <hr class="section-divider">
                        <h2 class="text-center text-accent-secondary">IV. The Fallen (Player Elimination)</h2>
                        <p class="text-center mb-8">Choose ONE of the following systems to handle eliminated players.</p>

                        <!-- § 10.7 Path of Glory -->
                        <div class="info-card">
                            <h3 class="!mt-0" id="s10_7"><span class="rule-number">§ 10.7</span>Module: Path of Glory<span title="Path of Glory Module" class="module-icon ml-2">🏆</span></h3>
                            <blockquote><strong>Complexity:</strong> Low | <strong>Style:</strong> Arcade / Competitive</blockquote>
                            <p>Replaces Vassalage. Eliminated players collect <strong>Glory Points (GP)</strong>.</p>
                            <div class="table-responsive-wrapper">
                                <table><thead><tr><th>Condition</th><th>GP Earned</th></tr></thead>
                                <tbody>
                                    <tr><td>Defeat any player's last Daimyō</td><td>+2 GP</td></tr>
                                    <tr><td>Defeat Leading Player's last Daimyō</td><td>+3 GP</td></tr>
                                    <tr><td>Gain sole control of Mandate Province</td><td>+3 GP</td></tr>
                                </tbody></table>
                            </div>
                            <p class="mt-4"><strong>Victory:</strong> Reach 7 GP to win immediately.</p>
                        </div>

                        <!-- § 10.8 Way of the Ronin -->
                        <div class="info-card">
                            <h3 class="!mt-0" id="s10_8"><span class="rule-number">§ 10.8</span>Module: The Way of the Rōnin<span title="The Way of the Rōnin Module" class="module-icon ml-2">👺</span></h3>
                            
                            <div class="info-card !mt-6 border-accent-secondary bg-gray-900/50">
                                <p class="!mt-0 font-bold text-accent-secondary">EXPERIMENTAL / ADVANCED MODULE</p>
                                <p class="mt-2 text-sm"><strong>WARNING:</strong> This module changes the game genre from Strategy to Asymmetric Insurgency. High drama, high volatility.</p>
                            </div>

                            <blockquote>
                                <strong>Complexity:</strong> Maximum | <strong>Interaction:</strong> Maximum<br>
                                "Why hire a traitor? Because a dog without a leash bites everyone. Feed him, and he bites your enemies. Starve him, and he eats your children."
                            </blockquote>

                            <h4 class="mt-8" id="s10_8_1"><span class="rule-number">§ 10.8.1</span>Status: Rōnin (Player) & The Collapse</h4>
                            <p>A player losing their last province becomes a <strong>Rōnin (Player)</strong>. They keep 1 Daimyō figure to represent themselves. All other figures return to supply.</p>
                            <p class="mt-2"><strong>The Power Vacuum:</strong> All their former provinces immediately become <strong>NEUTRAL</strong>. Place 2 Neutral Bushi in each to represent local warlords filling the void.</p>

                            <h4 class="mt-8" id="s10_8_2"><span class="rule-number">§ 10.8.2</span>The Mercenary Market</h4>
                            <p>During the <strong>Planning Phase (Phase 1)</strong>, Rōnin (Players) may openly negotiate services for Koku (paid to private supply).</p>
                            <ul class="list-disc list-inside mt-2">
                                <li><strong>Deployment:</strong> Hired Rōnin (Player) attach to a Patron's army. They count towards the stacking limit (7).</li>
                                <li><strong>Binding Agreements:</strong> Agreements (e.g., "Attack Player C") are binding while paid.</li>
                            </ul>

                            <h4 class="mt-8" id="s10_8_3"><span class="rule-number">§ 10.8.3</span>The Hunger Rule (Banditry)</h4>
                            <p>If hired by <strong>NO ONE</strong> during a round, the Rōnin (Player) becomes a Bandit in the <strong>Winter Phase (Phase 3)</strong>.</p>
                            <ul class="list-disc list-inside mt-2">
                                <li><strong>Effect:</strong> They place their figure in any opponent's province. That province pays <strong>DOUBLE Unit Maintenance</strong>.</li>
                                <li><strong>Immunity:</strong> Bandits cannot be attacked. They are a guerrilla threat handled only by bribery (hiring them next turn).</li>
                            </ul>

                            <h4 class="mt-8" id="s10_8_4"><span class="rule-number">§ 10.8.4</span>Hero Momentum</h4>
                            <p>During <strong>Combat Resolution (Phase 2)</strong>, the Rōnin (Player) provides unique benefits:</p>
                            <ol class="list-decimal list-inside mt-2">
                                <li><strong>Inspiration:</strong> Rōnin (Player) counts as a Daimyō (allows re-roll for the army).</li>
                                <li><strong>Glory:</strong> If the army wins, the <strong>Rōnin (Player)</strong> (not the Patron) gains a <strong>Glory Marker</strong>.</li>
                                <li><strong>Plot Armor:</strong> The Rōnin (Player) cannot be assigned as a casualty unless the entire army is wiped out.</li>
                            </ol>

                            <h4 class="mt-8" id="s10_8_5"><span class="rule-number">§ 10.8.5</span>Gekokujō (The Betrayal)</h4>
                            <p><strong>Condition:</strong> Minimum 3 Glory Markers.</p>
                            <p>The Rōnin (Player) may declare a coup <strong>immediately before any combat die roll</strong> involving their army. Roll 1d6:</p>
                            <ul class="list-disc list-inside ml-4 mt-2">
                                <li><strong>1-3 (Execution):</strong> Rōnin (Player) is killed and eliminated from the game.</li>
                                <li><strong>4-6 (Success):</strong> Immediate usurpation. Trigger § 10.8.6 immediately.</li>
                            </ul>

                            <div class="info-card border-accent-secondary bg-gray-900/50 mt-6">
                                <h4 class="!mt-0 !border-b-accent-secondary/50" id="s10_8_6"><span class="rule-number">§ 10.8.6</span>The Usurper's Reward</h4>
                                <p>Upon a successful coup (Roll 4-6), the Rōnin (Player) returns as a Daimyō and gains the following <strong>immediately</strong>:</p>
                                <ol class="list-decimal list-inside space-y-3 mt-4">
                                    <li><strong>Army Seizure:</strong> ALL units in the province (even the Patron's) become the Rōnin's units immediately.</li>
                                    <li><strong>Treasury Heist:</strong> Steal <strong>50%</strong> (rounded down) of the victim's current Koku treasury.</li>
                                    <li><strong>Momentum:</strong> Perform one immediate free <strong>Move/Attack action</strong> with the new army.</li>
                                </ol>
                            </div>
                        </div>

                    </div></div>
                </section>
                `,
'strategy': `
                <section id="page-strategy" class="page-container">
                    <div class="py-12 px-4"><div class="max-w-4xl mx-auto">
<header class="page-header">
    <div class="header-content">
        <h1>Strategy</h1>
        <p class="subtitle">A Manual for Survival, Not Glory</p>
    </div>
</header>

<section id="s8_clans_guide" class="page-section">
    <h2>The Foundation: An Assessment of Clan Capabilities</h2>
    <p class="text-gray-400 mb-6">Victory requires a clear understanding of one’s tools. The following assessments outline the inherent advantages and structural weaknesses of each clan. Do not mistake these for guarantees of success; they are merely starting conditions.</p>

    <div class="space-y-6">
        <!-- Chosokabe -->
        <details class="bg-gray-800 p-4 rounded-lg">
            <summary class="cursor-pointer font-semibold">The Chosokabe Clan (The Administrator)</summary>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2">
                    <h4 class="!mt-0 !border-b-0">Operational Doctrine</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Economic Accumulation:</strong> The clan's advantage lies in compounding income. Secure two coastal provinces early. This fiscal surplus is your only reliable weapon.</li>
                        <li><strong>Defensive Growth:</strong> Construct a Castle. Recruit steadily. Avoid early conflicts that drain the treasury before it can mature.</li>
                    </ul>
                    <h4 class="mt-6">Counter-Strategies</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Preemptive Strike:</strong> Attack before their economy stabilizes. A Chosokabe player without a treasury is merely a target.</li>
                        <li><strong>Coastal Denial:</strong> Occupying their coastline is more damaging than defeating their armies.</li>
                    </ul>
                </div>
                <div>
                    <h4 class="!mt-0 !border-b-0">Base of Operations</h4>
                    <div class="text-center p-2 rounded-lg bg-gray-900">
                        <img src="images/provinces/tosa-600.jpg" alt="Map showing Tosa province" class="w-full h-auto rounded-md">
                        <p class="text-xs text-gray-400 mt-2">Start: Tosa. Secure Shikoku. Then look north.</p>
                    </div>
                </div>
            </div>
        </details>
        <!-- Hojo -->
        <details class="bg-gray-800 p-4 rounded-lg">
            <summary class="cursor-pointer font-semibold">The Hōjō Clan (The Architect)</summary>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2">
                    <h4 class="!mt-0 !border-b-0">Operational Doctrine</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Fortification:</strong> Your priority is the Fortress in Sagami. It is a static anchor in a fluid map.</li>
                        <li><strong>Central Projection:</strong> Sagami is a Mandate Province. Secure your base, then methodically expand toward Kyoto and Osaka. Do not overextend.</li>
                    </ul>
                    <h4 class="mt-6">Counter-Strategies</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Bypass:</strong> Do not assault the Fortress. The +2 defense bonus is a mathematical trap. Win by conquering the undefended periphery.</li>
                        <li><strong>Containment:</strong> Isolate Sagami. A fortress without income is a tomb.</li>
                    </ul>
                </div>
                <div>
                    <h4 class="!mt-0 !border-b-0">Base of Operations</h4>
                    <div class="text-center p-2 rounded-lg bg-gray-900">
                        <img src="images/provinces/sagami-600.jpg" alt="Map showing Sagami province" class="w-full h-auto rounded-md">
                        <p class="text-xs text-gray-400 mt-2">Start: Sagami. Your fortress is your mandate.</p>
                    </div>
                </div>
            </div>
        </details>
        <!-- Mori -->
        <details class="bg-gray-800 p-4 rounded-lg">
            <summary class="cursor-pointer font-semibold">The Mōri Clan (The Navigator)</summary>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2">
                    <h4 class="!mt-0 !border-b-0">Operational Doctrine</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Coastal Chain:</strong> Your economy and mobility depend on contiguous coastal control. Lose the coast, and you lose your advantage.</li>
                        <li><strong>Asymmetric Threat:</strong> For 1 Koku, you can redeploy force across the map. Use this to strike undefended rears. The threat of movement is often as useful as the movement itself.</li>
                    </ul>
                    <h4 class="mt-6">Counter-Strategies</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Sever the Line:</strong> Capture a central coastal province to break their transit network.</li>
                        <li><strong>Rear Guard:</strong> Do not leave coastal centers undefended. The Mōri rely on your negligence.</li>
                    </ul>
                </div>
                <div>
                    <h4 class="!mt-0 !border-b-0">Base of Operations</h4>
                    <div class="text-center p-2 rounded-lg bg-gray-900">
                         <img src="images/provinces/aki-600.jpg" alt="Map showing Aki province" class="w-full h-auto rounded-md">
                        <p class="text-xs text-gray-400 mt-2">Start: Aki. Dominate the inland sea.</p>
                    </div>
                </div>
            </div>
        </details>
        <!-- Oda -->
        <details class="bg-gray-800 p-4 rounded-lg">
            <summary class="cursor-pointer font-semibold">The Oda Clan (The Belligerent)</summary>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2">
                    <h4 class="!mt-0 !border-b-0">Operational Doctrine</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Leader-Centric Combat:</strong> Your troops are mediocre without a Daimyō. Concentrate force around your leaders to utilize the attack bonus.</li>
                        <li><strong>Aggressive Acquisition:</strong> You lack economic traits. You must take land from others to fund your army. Stagnation is death.</li>
                    </ul>
                    <h4 class="mt-6">Counter-Strategies</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Headhunting:</strong> Without a Daimyō, the Oda are just expensive peasants. Use Ninjas or targeted strikes to remove their leadership.</li>
                        <li><strong>Attrition:</strong> Avoid pitched battles. Force them to split their armies, diluting their leadership bonus.</li>
                    </ul>
                </div>
                <div>
                    <h4 class="!mt-0 !border-b-0">Base of Operations</h4>
                    <div class="text-center p-2 rounded-lg bg-gray-900">
                        <img src="images/provinces/owari-600.jpg" alt="Map showing Owari province" class="w-full h-auto rounded-md">
                        <p class="text-xs text-gray-400 mt-2">Start: Owari. A central position for a central threat.</p>
                    </div>
                </div>
            </div>
        </details>
        <!-- Otomo -->
        <details class="bg-gray-800 p-4 rounded-lg">
            <summary class="cursor-pointer font-semibold">The Otomo Clan (The Speculator)</summary>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2">
                    <h4 class="!mt-0 !border-b-0">Operational Doctrine</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Fiscal Discipline:</strong> Your ability costs 2 Koku. Do not waste it on skirmishes. Hoard your wealth.</li>
                        <li><strong>Calculated Risk:</strong> Use your re-roll ability only when the outcome decides the game—seizing a Mandate Province or eliminating a rival.</li>
                    </ul>
                    <h4 class="mt-6">Counter-Strategies</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Economic Warfare:</strong> Force them into frequent, low-value conflicts to drain their treasury.</li>
                        <li><strong>Defensive Posture:</strong> Their advantage is offensive. Force them to defend, and they are ordinary.</li>
                    </ul>
                </div>
                <div>
                    <h4 class="!mt-0 !border-b-0">Base of Operations</h4>
                    <div class="text-center p-2 rounded-lg bg-gray-900">
                        <img src="images/provinces/bungo-600.jpg" alt="Map showing Bungo province" class="w-full h-auto rounded-md">
                        <p class="text-xs text-gray-400 mt-2">Start: Bungo. Consolidate Kyushu, then buy your victory.</p>
                    </div>
                </div>
            </div>
        </details>
        <!-- Shimazu -->
        <details class="bg-gray-800 p-4 rounded-lg">
            <summary class="cursor-pointer font-semibold">The Shimazu Clan (The Expansionist)</summary>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2">
                    <h4 class="!mt-0 !border-b-0">Operational Doctrine</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Coastal Imperative:</strong> Capture three coastal provinces immediately. This maximizes your income bonus.</li>
                        <li><strong>Momentum:</strong> Convert early economic gains directly into troop numbers. You must snowball before your rivals stabilize.</li>
                    </ul>
                    <h4 class="mt-6">Counter-Strategies</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Early Containment:</strong> Contest coastal provinces to starve their economy.</li>
                        <li><strong>Patience:</strong> Their bonus is capped. If you survive the early game, their advantage diminishes.</li>
                    </ul>
                </div>
                <div>
                    <h4 class="!mt-0 !border-b-0">Base of Operations</h4>
                    <div class="text-center p-2 rounded-lg bg-gray-900">
                        <img src="images/provinces/satsuma-600.jpg" alt="Map showing Satsuma province" class="w-full h-auto rounded-md">
                        <p class="text-xs text-gray-400 mt-2">Start: Satsuma. Secure the corner, then push north.</p>
                    </div>
                </div>
            </div>
        </details>
        <!-- Takeda -->
        <details class="bg-gray-800 p-4 rounded-lg">
            <summary class="cursor-pointer font-semibold">The Takeda Clan (The Cavalryman)</summary>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2">
                    <h4 class="!mt-0 !border-b-0">Operational Doctrine</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Central Posture:</strong> Position your main force centrally. Your threat radius is larger than any other clan's.</li>
                        <li><strong>Deep Strike:</strong> Utilize the 3-province movement to bypass front lines and strike critical, rear-area targets.</li>
                    </ul>
                    <h4 class="mt-6">Counter-Strategies</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Screening:</strong> A single Bushi can stop an army. Use picket lines to negate their mobility advantage.</li>
                        <li><strong>Base Strike:</strong> When the Takeda army moves out, their home is often exposed. Attack the empty nest.</li>
                    </ul>
                </div>
                <div>
                    <h4 class="!mt-0 !border-b-0">Base of Operations</h4>
                    <div class="text-center p-2 rounded-lg bg-gray-900">
                        <img src="images/provinces/kai-600.jpg" alt="Map showing Kai province" class="w-full h-auto rounded-md">
                        <p class="text-xs text-gray-400 mt-2">Start: Kai. Speed is your armor.</p>
                    </div>
                </div>
            </div>
        </details>
        <!-- Tokugawa -->
        <details class="bg-gray-800 p-4 rounded-lg">
            <summary class="cursor-pointer font-semibold">The Tokugawa Clan (The Patient)</summary>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2">
                    <h4 class="!mt-0 !border-b-0">Operational Doctrine</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Highland Entrenchment:</strong> Occupy mountain provinces. For others, they are a burden; for you, they are free fortresses.</li>
                        <li><strong>Attrition:</strong> You play a long game. Let others exhaust themselves fighting for the plains while you build strength in the mountains.</li>
                    </ul>
                    <h4 class="mt-6">Counter-Strategies</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Denial:</strong> Contest mountain provinces early. Without them, the Tokugawa advantage is null.</li>
                        <li><strong>Ignore Them:</strong> Do not attack them in the mountains. Expand elsewhere and out-produce them.</li>
                    </ul>
                </div>
                <div>
                    <h4 class="!mt-0 !border-b-0">Base of Operations</h4>
                    <div class="text-center p-2 rounded-lg bg-gray-900">
                        <img src="images/provinces/mikawa-600.jpg" alt="Map showing Mikawa province" class="w-full h-auto rounded-md">
                        <p class="text-xs text-gray-400 mt-2">Start: Mikawa. Wait. The mountain does not move.</p>
                    </div>
                </div>
            </div>
        </details>
        <!-- Uesugi -->
        <details class="bg-gray-800 p-4 rounded-lg">
            <summary class="cursor-pointer font-semibold">The Uesugi Clan (The Sentinel)</summary>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2">
                    <h4 class="!mt-0 !border-b-0">Operational Doctrine</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Static Defense:</strong> Your ability turns any province held at the start of the round into a hardpoint. Secure chokepoints and force the enemy to come to you.</li>
                        <li><strong>Methodical Advance:</strong> Conquer, hold for a round to activate your bonus, then advance. Do not rush.</li>
                    </ul>
                    <h4 class="mt-6">Counter-Strategies</h4>
                    <ul class="list-disc list-inside space-y-2">
                        <li><strong>Indirect Approach:</strong> Do not attack where they are strong. Force them to attack you.</li>
                        <li><strong>Tempo:</strong> Strike provinces they have just conquered *this round*. They are vulnerable before they can dig in.</li>
                    </ul>
                </div>
                <div>
                    <h4 class="!mt-0 !border-b-0">Base of Operations</h4>
                    <div class="text-center p-2 rounded-lg bg-gray-900">
                        <img src="images/provinces/echigo-600.jpg" alt="Map showing Echigo province" class="w-full h-auto rounded-md">
                        <p class="text-xs text-gray-400 mt-2">Start: Echigo. Let them break upon your walls.</p>
                    </div>
                </div>
            </div>
        </details>
    </div>
</section>

<section id="s8_war_college" class="page-section">
    <h2>The Library: Historical Precedents</h2>
    <p class="text-gray-400 mb-6">The dilemmas you face on the board are abstractions of real historical crises. While plastic figures feel no pain, the logic of their movement remains consistent with ancient doctrine. Consider the following not as rules, but as observations.</p>

    <details class="bg-gray-800 p-4 rounded-lg mt-4">
        <summary class="cursor-pointer font-semibold text-xl">Sun Tzu: Notes on Efficiency</summary>
        <div class="mt-6">
            <p class="mb-6 text-gray-400">Written in the 5th century BCE, these aphorisms are often quoted but rarely understood. In the context of this game, they are practical advice for resource management.</p>
            <div class="space-y-4">
                <blockquote class="border-l-4 border-accent-secondary pl-4 italic">"The supreme art of war is to subdue the enemy without fighting." <br><span class="text-xs text-gray-500 not-italic">- Use the Ninja's 'Deny Passage' to halt an army for 3 Koku, cheaper than raising an army to fight it.</span></blockquote>
                <blockquote class="border-l-4 border-accent-secondary pl-4 italic">"All warfare is based on deception." <br><span class="text-xs text-gray-500 not-italic">- Your hidden Koku supply is your only true secret. Guard it.</span></blockquote>
                <blockquote class="border-l-4 border-accent-secondary pl-4 italic">"He will win who knows when to fight and when not to fight." <br><span class="text-xs text-gray-500 not-italic">- Retreat is a valid maneuver. Losing a province is preferable to losing an army you cannot afford to replace.</span></blockquote>
            </div>
        </div>
    </details>

    <details class="bg-gray-800 p-4 rounded-lg mt-4">
        <summary class="cursor-pointer font-semibold text-xl">The Thirty-Six Stratagems: A Catalogue of Deceit</summary>
        <div class="mt-6">
            <p class="mb-6 text-gray-400">These Chinese idioms illustrate that fairness is not a virtue in conflict. They are categorized here by their utility in the game.</p>
            <div class="space-y-8">
                <div>
                    <h4 class="!mt-0 !border-b-gray-700 text-lg">I. Economy of Force</h4>
                    <div class="space-y-4 mt-4">
                        <p id="stratagem-1"><strong>1. Deceive the Heavens to Cross the Sea:</strong> Mask a major offensive with routine maneuvers.</p>
                        <p id="stratagem-2"><strong>2. Besiege Wèi to Rescue Zhào:</strong> Attack an enemy's resource base to force their main army to retreat.</p>
                        <p id="stratagem-3"><strong>3. Kill with a Borrowed Sword:</strong> Maneuver a third party into attacking your enemy. Or, use a Ninja.</p>
                        <p id="stratagem-4"><strong>4. Await the Exhausted Enemy at Your Ease:</strong> Fortify and wait. Let the enemy spend Koku on movement while you accrue interest.</p>
                        <p id="stratagem-5"><strong>5. Loot a Burning House:</strong> When a player is bankrupted by a Ninja, attack them immediately.</p>
                        <p id="stratagem-6"><strong>6. Make a Sound in the East, Then Strike in the West:</strong> Position a threat on one border, then move your Takeda cavalry to the other.</p>
                    </div>
                </div>
                 <div>
                    <h4 class="!mt-8 !border-b-gray-700 text-lg">II. Opportunism</h4>
                    <div class="space-y-4 mt-4">
                        <p id="stratagem-9"><strong>9. Watch the Fires Burning Across the River:</strong> Do not intervene in a war between rivals. Wait until the winner is weakened, then destroy them.</p>
                        <p id="stratagem-10"><strong>10. Hide a Knife Behind a Smile:</strong> Form an Alliance. Break it when the profit exceeds the cost of the Blood Feud.</p>
                        <p id="stratagem-11"><strong>11. Sacrifice the Plum Tree to Preserve the Peach Tree:</strong> Lose a province to save a Daimyō.</p>
                        <p id="stratagem-12"><strong>12. Take the Opportunity to Pilfer a Goat:</strong> If a province is undefended, take it. Do not overthink it.</p>
                    </div>
                </div>
                <div>
                    <h4 class="!mt-8 !border-b-gray-700 text-lg">III. Attack & Chaos</h4>
                     <div class="space-y-4 mt-4">
                        <p id="stratagem-15"><strong>15. Lure the Tiger Down from the Mountain:</strong> Bait a defensive player (Tokugawa) into attacking you on open ground.</p>
                        <p id="stratagem-19"><strong>19. Remove the Firewood from Under the Pot:</strong> Use "Burn the Supplies!" to destroy the enemy's ability to pay upkeep.</p>
                        <p id="stratagem-20"><strong>20. Disturb the Water and Catch a Fish:</strong> Use a Ninja to create chaos in a multi-player battle, then seize the objective.</p>
                         <p id="stratagem-36"><strong>36. If All Else Fails, Retreat:</strong> Survival is the only victory condition that matters. There is no shame in running away.</p>
                    </div>
                </div>
            </div>
        </div>
    </details>
</section>

<section id="s8_synthesis" class="page-section">
    <h2>The Synthesis: Applying Doctrine</h2>
    <p class="text-gray-400 mb-6">Theory is useless without application. Here is how the abstract principles above apply to the specific asymmetrical advantages of the clans.</p>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="info-card">
            <h4 class="!mt-0">Hōjō: Stratagem #4</h4>
            <p><strong>Await the Exhausted:</strong> The Hōjō ability allows you to do nothing effectively. Build your fortress. Let them come. Every turn they spend marching is Koku they are not spending on soldiers.</p>
        </div>
        <div class="info-card">
            <h4 class="!mt-0">Mōri: Stratagem #15</h4>
            <p><strong>Lure the Tiger:</strong> If an enemy is entrenched inland, use your naval mobility to threaten their undefended coast. Force them to leave their fortifications to chase you.</p>
        </div>
        <div class="info-card">
             <h4 class="!mt-0">Uesugi: Stratagem #16</h4>
            <p><strong>Capture by Letting Loose:</strong> Leave a low-value province lightly defended to bait an attack. Once the enemy extends, they lose their defensive bonus. Yours remains intact.</p>
        </div>
        <div class="info-card">
            <h4 class="!mt-0">Otomo: Stratagem #17</h4>
            <p><strong>Toss a Brick for Jade:</strong> Your ability costs 2 Koku (the brick). Use it only to secure a Mandate Province (the jade). Anything less is a poor return on investment.</p>
        </div>
        <div class="info-card">
            <h4 class="!mt-0">Tokugawa: Stratagem #9</h4>
            <p><strong>Watch the Fires:</strong> Your mountain immunity lets you hold territory cheaply. Let others fight over the expensive plains. Intervene only when the outcome is certain.</p>
        </div>
        <div class="info-card">
            <h4 class="!mt-0">Takeda: Stratagem #6</h4>
            <p><strong>Sound East, Strike West:</strong> Mass troops on one border to force an enemy reaction. Then use your movement bonus to strike a completely different target before they can redeploy.</p>
        </div>
    </div>
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
                    <tr><td data-label="Step"><strong>3.0</strong></td><td data-label="Action"><strong>Ninja Intervention Step</strong></td><td data-label="Notes">Window for Ninja player to act.</td></tr>
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
                                    <li>(Optional) <strong>Ninja Intervention:</strong> The Ninja player may reveal a mission (e.g., "Sow Discord!") if present.</li>
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
                                            <tr><td data-label="Source"><strong>Ninja (Sow Discord!)</strong></td><td data-label="Effect">-1 on all rolls</td><td data-label="Condition">Ninja uses "Sow Discord!" command.</td></tr>
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
                                        <thead><tr><th data-label="Type">Mission Type</th><th data-label="Command">Command</th><th data-label="Effect">Effect</th></tr></thead>
                                        <tbody>
                                            <tr><td data-label="Type"><strong>Open Mission</strong></td><td data-label="Command">"Deny Passage!"</td><td data-label="Effect">Triggered by movement. Enemy pays 3 Koku or cancels move.</td></tr>
                                            <tr><td data-label="Type"><strong>Open Mission</strong></td><td data-label="Command">"Sow Discord!"</td><td data-label="Effect">Triggered by battle. Target suffers -1 to all rolls.</td></tr>
                                            <tr><td data-label="Type"><strong>Open Mission</strong></td><td data-label="Command">"Burn the Supplies!"</td><td data-label="Effect">Triggered by battle. Target pays 3 Koku or loses units (Bankruptcy).</td></tr>
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
                                <li><strong>Attacker:</strong> The player who moves units into a province occupied by an opponent.</li>
                                <li><strong>Blood Feud:</strong> A permanent state of conflict declared by a betrayed player, granting them combat bonuses against the betrayer.</li>
                                <li><strong>Burn the Supplies!:</strong> A Ninja command that forces an opponent to pay Koku or lose units.</li>
                                <li><strong>Bushi:</strong> Standard warrior figures, the backbone of your army.</li>
                                <!-- ... (Castle/Clan/Contested/Controlled/Daimyo/Defender/Enemy Target remain the same) ... -->
                                <li><strong>Deny Passage!:</strong> A Ninja command that forces an opponent to pay Koku or cancel movement.</li>
                                <!-- ... (Gekokujo/Glory Points/Honor Pact/Koku/Mandate/Module/Province/Raiding/Ronin/Shogun/Spoilage/Stacking/Mountain/Unit Maint/Uncontrolled/Vassal remain the same) ... -->
                                <li><strong>Sow Discord!:</strong> A Ninja command that inflicts a penalty on combat rolls.</li>
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
