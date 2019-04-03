/*
 * HC Off-canvas Nav
 * ===================
 * Version: 3.4.1
 * Author: Some Web Media
 * Author URL: http://somewebmedia.com
 * Plugin URL: https://github.com/somewebmedia/hc-offcanvas-nav
 * Description: jQuery plugin for creating off-canvas multi-level navigations
 * License: MIT
 */

'use strict';

(function ($, window) {
  const document = window.document;
  const $html = $(document.getElementsByTagName('html')[0]);

  const hasScrollBar = () => {
    return document.documentElement.scrollHeight > document.documentElement.clientHeight;
  };

  const isIos = (() => {
    return ((/iPad|iPhone|iPod/.test(navigator.userAgent)) || (!!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform))) && !window.MSStream;
  })();

  const isTouchDevice = (() => {
    return 'ontouchstart' in window || navigator.maxTouchPoints || (window.DocumentTouch && document instanceof DocumentTouch);
  })();

  const toMs = (s) => {
    return parseFloat(s) * (/\ds$/.test(s) ? 1000 : 1);
  };

  const ID = function () {
    return Math.random().toString(36).substr(2) + '-' + Math.random().toString(36).substr(2);
  };

  const stopPropagation = (e) => e.stopPropagation();

  const preventClick = (cb) => {
    return (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof cb === 'function') cb();
    };
  };

  const getElementCssTag = (el) => {
    return typeof el === 'string'
      ? el
      : el.attr('id')
        ? '#' + el.attr('id')
        : el.attr('class')
          ? el.prop('tagName').toLowerCase() + '.' + el.attr('class').replace(/\s+/g, '.')
          : getElementCssTag(el.parent()) + ' ' + el.prop('tagName').toLowerCase();
  };

  const printStyle = (id) => {
    const $style = $(`<style id="${id}">`).appendTo($('head'))
    let rules = {};
    let media = {};

    const parseRules = (text) => {
      if (text.substr(-1) !== ';') {
        text += text.substr(-1) !== ';' ? ';' : '';
      }
      return text;
    };

    return {
      reset: () => {
        rules = {};
        media = {};
      },
      add: (selector, declarations, query) => {
        selector = selector.trim();
        declarations = declarations.trim();

        if (query) {
          query = query.trim();
          media[query] = media[query] || {};
          media[query][selector] = parseRules(declarations);
        }
        else {
          rules[selector] = parseRules(declarations);
        }
      },
      remove: (selector, query) => {
        selector = selector.trim();

        if (query) {
          query = query.trim();
          if (typeof media[query][selector] !== 'undefined') {
            delete media[query][selector];
          }
        }
        else {
          if (typeof rules[selector] !== 'undefined') {
            delete rules[selector];
          }
        }
      },
      insert: () => {
        let cssText = '';

        for (let breakpoint in media) {
          cssText += `@media screen and (${breakpoint}) {\n`;

          for (let key in media[breakpoint]) {
            cssText += `${key} { ${media[breakpoint][key]} }\n`;
          }

          cssText += '}\n';
        }

        for (let key in rules) {
          cssText += `${key} { ${rules[key]} }\n`;
        }

        $style.html(cssText);
      }
    };
  };

  let navCount = 0;

  $.fn.extend({
    hcOffcanvasNav: function (options = {}) {
      if (!this.length) return this;

      const self = this;
      // get body of the current document
      const $body = $(document.body);

      const defaults = {
        maxWidth: 1024,
        // left, right, top, bottom
        position: 'left',

        levelSpacing: 40,

        navTitle: null,
        navClass: '',
        customToggle: null,

        labelClose: 'Close',
        labelBack: 'Back to Main Menu'
      };

      let Settings = $.extend({}, defaults, options);
      let UpdatedSettings = [];

      const navOpenClass = 'nav-open';

      const checkForUpdate = (options) => {
        if (!UpdatedSettings.length) {
          return false;
        }

        let hasUpdated = false;

        if (typeof options === 'string') {
          options = [options];
        }

        let l = options.length;
        for (let i = 0; i < l; i++) {
          if (UpdatedSettings.indexOf(options[i]) !== -1) {
            hasUpdated = true;
          }
        }

        return hasUpdated;
      };

      const Plugin = function () {
        const $this = $(this);

        if (!$this.find('ul').addBack('ul').length) {
          console.error('%c! HC Offcanvas Nav:' + `%c Menu must contain <ul> element.`, 'color: #fa253b', 'color: default');
          return;
        }

        // count our nav
        navCount++;

        const navUniqId = `hc-nav-${navCount}`;
        const Styles = printStyle(`hc-offcanvas-${navCount}-style`);

        let $toggle;

        // add classes to original menu so we know it's connected to our copy
        $this.addClass(`hc-nav ${navUniqId}`);

        // this is our nav
        // prevent menu close on self click
        const $nav = $('<nav>').on('click', stopPropagation); 
        const $nav_container = $('<div class="nav-container">').appendTo($nav);

        let Model = {};
        let _open = false;
        let _top = 0;
        let _containerWidth = 0;
        let _containerHeight = 0;
        let _transitionDuration;
        let _closeLevelsTimeout = null;
        // object with level indexes
        let _indexes = {}; 

        // toggle
        if (!Settings.customToggle) {
          $toggle = $(`<a class="hc-nav-trigger ${navUniqId}"><span></span></a>`).on('click', toggleNav);
          $this.after($toggle);
        }
        else {
          $toggle = $(Settings.customToggle).addClass(`hc-nav-trigger ${navUniqId}`).on('click', toggleNav);
        }

        const calcNav = () => {
          // remove transition from the nav container so we can update the nav without flickering
          $nav_container.css('transition', 'none');

          _containerWidth = $nav_container.outerWidth();
          _containerHeight = $nav_container.outerHeight();

          // fix 100% transform glitching
          Styles.add(`.hc-offcanvas-nav.${navUniqId}.nav-position-left .nav-container`, `transform: translate3d(-${_containerWidth}px, 0, 0)`);
          Styles.add(`.hc-offcanvas-nav.${navUniqId}.nav-position-right .nav-container`, `transform: translate3d(${_containerWidth}px, 0, 0)`);
          Styles.add(`.hc-offcanvas-nav.${navUniqId}.nav-position-top .nav-container`, `transform: translate3d(0, -${_containerHeight}px, 0)`);
          Styles.add(`.hc-offcanvas-nav.${navUniqId}.nav-position-bottom .nav-container`, `transform: translate3d(0, ${_containerHeight}px, 0)`);

          Styles.insert();

          // clear our 'none' inline transition
          $nav_container.css('transition', '');

          pageContentTransition();
        };

        const pageContentTransition = () => {
          _transitionDuration = toMs($nav_container.css('transition-duration').split(',')[0]);
        };

        // init function
        const initNav = (reInit) => {
          const toggleDisplay = $toggle.css('display');
          const mediaquery = Settings.maxWidth ? `max-width: ${Settings.maxWidth - 1}px` : false;

          // clear media queries from previous run
          if (checkForUpdate('maxWidth')) {
            Styles.reset();
          }

          // create main styles
          Styles.add(`.hc-offcanvas-nav.${navUniqId}`, 'display: block', mediaquery);
          Styles.add(`.hc-nav-trigger.${navUniqId}`, `display: ${toggleDisplay && toggleDisplay !== 'none' ? toggleDisplay : 'block'}`, mediaquery);
          Styles.add(`.hc-nav.${navUniqId}`, 'display: none', mediaquery);

          Styles.add(`.hc-offcanvas-nav.${navUniqId}.nav-levels-expandOverlap.nav-position-left li ul li.level-open > .nav-wrapper`, `transform: translate3d(0,0,0)`, mediaquery);
          Styles.add(`.hc-offcanvas-nav.${navUniqId}.nav-levels-expandOverlap.nav-position-right li ul li.level-open > .nav-wrapper`, `transform: translate3d(0,0,0)`, mediaquery);
          Styles.add(`.hc-offcanvas-nav.${navUniqId}.nav-levels-expandOverlap.nav-position-top li ul li.level-open > .nav-wrapper`, `transform: translate3d(0,0,0)`, mediaquery);
          Styles.add(`.hc-offcanvas-nav.${navUniqId}.nav-levels-expandOverlap.nav-position-bottom li ul li.level-open > .nav-wrapper`, `transform: translate3d(0,0,0)`, mediaquery);

          //Styles.insert();

          // remove transition from the nav container so we can update the nav without flickering
          $nav_container.css('transition', 'none');

          const wasOpen = $nav.hasClass(navOpenClass);

          const navClasses = [
            'hc-offcanvas-nav',
            Settings.navClass || '',
            navUniqId,
            Settings.navClass || '',
            'nav-levels-expandOverlap',
            'nav-position-' + Settings.position,
            'disable-body',
            isIos ? 'is-ios' : '',
            isTouchDevice ? 'touch-device' : '',
            wasOpen ? navOpenClass : ''
          ].join(' ');

          $nav
            .off('click')
            .attr('class', '')
            .addClass(navClasses);

          // close menu on body click (nav::after)
          $nav.on('click', closeNav);

          if (reInit) {
            calcNav();
          }
          else {
            // timed out so we can get computed data
            setTimeout(calcNav, 1);
          }
        };

        // create nav model function
        const createModel = () => {
          // get first level menus
          const $first_level = () => {
            const $ul = $this.find('ul').addBack('ul'); // original nav menus
            return $ul.first().add($ul.first().siblings('ul'));
          };

          // call
          Model = getModel($first_level());

          function getModel($menu) {
            const level = [];

            $menu.each(function () {
              const $ul = $(this);

              const nav = {
                classes: $ul.attr('class'),
                items: []
              };

              $ul.children('li').each(function () {
                const $li = $(this);
                const $content = $li.children().filter(function () {
                  const $this = $(this);
                  return $this.is(':not(ul)') && !$this.find('ul').length;
                }).add($li.contents().filter(function () {
                  return this.nodeType === 3 && this.nodeValue.trim();
                }));
                const $nested_navs = $li.find('ul');
                const $subnav = $nested_navs.first().add($nested_navs.first().siblings('ul'));

                // save unique identifier for remembering open menus
                if ($subnav.length && !$li.data('hc-uniqid')) {
                  $li.data('hc-uniqid', ID());
                }

                // add elements to this level
                nav.items.push({
                  uniqid: $li.data('hc-uniqid'),
                  classes: $li.attr('class'),
                  $content: $content,
                  subnav: $subnav.length ? getModel($subnav) : []
                });
              });

              level.push(nav);
            });

            return level;
          }
        };

        // create nav DOM function
        const createNavDom = (reInit) => {
          if (reInit) {
            // empty the container
            $nav_container.empty();
            // reset indexes
            _indexes = {};
          }

          // call
          createDom(Model, $nav_container, 0, Settings.navTitle);

          function createDom(menu, $container, level, title, backIndex) {
            // insert close link
            if (level === 0) {
              const $close = $(`<li class="nav-close"><a href="#">${Settings.labelClose || ''}<span></span></a></li>`);

              $close.children('a').on('click', preventClick(closeNav));

              $close.appendTo($container)
            }

            const $wrapper = $(`<div class="nav-wrapper nav-wrapper-${level}">`).appendTo($container).on('click', stopPropagation);
            const $content = $('<div class="nav-content">').appendTo($wrapper);

            // titles
            if (title) {
              $content.prepend(`<h2>${title}</h2>`);
            }

            $.each(menu, (i_nav, nav) => {
              const $menu = $(`<ul>`).addClass(nav.classes).appendTo($content);

              $.each(nav.items, (i_item, item) => {
                const $item_content = item.$content;
                let $item_link = $item_content.find('a').addBack('a');
                const $a = $item_link.length ? $item_link.clone(true, true).addClass('nav-item') : $(`<span class="nav-item">`).append($item_content.clone(true, true)).on('click', stopPropagation);

                // on click trigger original link
                if ($item_link.length) {
                  $a.on('click', (e) => {
                    e.stopPropagation();
                    $item_link[0].click();
                  });
                }

                if ($a.attr('href') === '#') {
                  // prevent page jumping
                  $a.on('click', (e) => {
                    e.preventDefault();
                  });
                }

                $a.filter('a').filter('[data-nav-close!="false"]').filter(function () {
                  const $this = $(this);
                  return !item.subnav.length || ($this.attr('href') && $this.attr('href').charAt(0) !== '#');
                }).on('click', closeNav);

                const $item = $(`<li>`).addClass(item.classes).append($a);

                // insert item
                $menu.append($item);

                // indent levels in expanded levels
                if (Settings.levelSpacing) {
                  const indent = level !== 1 ? 0 : Settings.levelSpacing;
                  $menu.css('text-indent', `${indent}px`);
                }

                // do subnav
                if (item.subnav.length) {
                  const nextLevel = level + 1;
                  const uniqid = item.uniqid;
                  let nav_title = '';

                  // create new level
                  if (!_indexes[nextLevel]) {
                    _indexes[nextLevel] = 0;
                  }

                  // li parent class
                  $item.addClass('nav-parent');
                  const index = _indexes[nextLevel];
                  const $next_span = $('<span class="nav-next">').appendTo($a);
                  const $next_label = $(`<label for="${navUniqId}-${nextLevel}-${index}">`).on('click', stopPropagation);
                  const $checkbox = $(`<input type="checkbox" id="${navUniqId}-${nextLevel}-${index}">`)
                    .attr('data-level', nextLevel)
                    .attr('data-index', index)
                    .val(uniqid)
                    .on('click', stopPropagation)
                    .on('change', checkboxChange);

                  // // nav is updated, we should keep this level open
                  // if (_openLevels.indexOf(uniqid) !== -1) {
                  //   $wrapper.addClass('sub-level-open').on('click', () => closeLevel(nextLevel, index)); // close on self click
                  //   $item.addClass('level-open');
                  //   $checkbox.prop('checked', true);
                  // }

                  $item.prepend($checkbox);

                  // subnav title
                  //nav_title = Settings.levelTitles === true ? $item_content.text().trim() : '';

                  if (!$a.attr('href') || $a.attr('href').charAt(0) === '#') {
                    $a.prepend($next_label.on('click', function () {
                      // trigger parent click in case it has custom click events
                      $(this).parent().trigger('click');
                    }));
                  }
                  else {
                    $next_span.append($next_label);
                  }

                  _indexes[nextLevel]++;

                  createDom(item.subnav, $item, nextLevel, nav_title, _indexes[nextLevel] - 1);
                }
              });
            });

            // insert back links
            if (level > 1 && typeof backIndex !== 'undefined') {
              const $children_menus = $content.children('ul');

              if (level === 2) {
                let $backMain = $(`<li class="nav-back"><a href="#"><span></span>${Settings.labelBack || 'Back'}</a></li>`);
                $backMain.children('a').on('click', preventClick(() => closeLevel(2)));
                $children_menus.first().prepend($backMain);
              }

              if (level > 2) {
                const backText = $content.parents('.nav-content').first().parents('.nav-parent').first().children('.nav-item').text();
                let $back = $(`<li class="nav-back"><a href="#"><span></span>${backText || 'Back'}</a></li>`);
                $back.children('a').on('click', preventClick(() => closeLevel(level, backIndex)));
                $children_menus.first().prepend($back);
              }
            }
          }
        };

        // init nav
        initNav();

        // init our Model
        createModel();

        // create view from model
        createNavDom();

        // insert nav to DOM
        $body.append($nav);

        // Private methods

        function checkboxChange() {
          const $checkbox = $(this);
          const l = Number($checkbox.attr('data-level'));
          const i = Number($checkbox.attr('data-index'));

          if ($checkbox.prop('checked')) {
            openLevel(l, i);
          }
          else {
            closeLevel(l, i);
          }
        }

        function openNav() {
          _open = true;

          $nav.css('visibility', 'visible').addClass(navOpenClass);
          $toggle.addClass('toggle-open');

          if (_closeLevelsTimeout) {
            clearTimeout(_closeLevelsTimeout);
          }

          _top = $html.scrollTop() || $body.scrollTop(); // remember scroll position

          if (hasScrollBar()) {
            $html.addClass('hc-nav-yscroll');
          }

          $body.addClass('hc-nav-open');

          if (_top) {
            $body.css('top', -_top);
          }

          // trigger open event
          setTimeout(() => {
            self.trigger('open', $.extend({}, Settings));
          }, _transitionDuration + 1);
        }

        function closeNav() {
          _open = false;

          $nav.removeClass(navOpenClass);
          $nav_container.removeAttr('style');
          $toggle.removeClass('toggle-open');

          if (['top', 'bottom'].indexOf(Settings.position) !== -1) {
            // close all levels before closing the nav because the nav height changed
            closeLevel(0);
          }
          else {
            // close all levels when nav closes
            _closeLevelsTimeout = setTimeout(() => {
              // keep in timeout so we can prevent it if nav opens again before it's closed
              closeLevel(0);
            }, _transitionDuration);
          }

            $body.removeClass('hc-nav-open');
            $html.removeClass('hc-nav-yscroll');

            if (_top) {
              $body.css('top', '').scrollTop(_top);
              $html.scrollTop(_top);

              _top = 0; // reset top
            }

          setTimeout(() => {
            $nav.css('visibility', '');

            // trigger close event
            self.trigger('close.$', $.extend({}, Settings));

            // only trigger close event once and detach it
            self.trigger('close.once', $.extend({}, Settings)).off('close.once');
          }, _transitionDuration + 1);
        }

        function toggleNav(e) {
          e.preventDefault();
          e.stopPropagation();

          if (_open) closeNav();
          else openNav();
        }

        function openLevel(l, i) {
          const $checkbox = $(`#${navUniqId}-${l}-${i}`);
          const uniqid = $checkbox.val();
          const $li = $checkbox.parent('li');
          const $wrap = $li.closest('.nav-wrapper');

          $wrap.addClass('sub-level-open');
          $li.addClass('level-open');

          // remember what is open
          // if (_openLevels.indexOf(uniqid) === -1) {
          //   _openLevels.push(uniqid);
          // }

          if (l < 2) {
            for (let levelIndex = 0; levelIndex <= _indexes[l]; levelIndex++) {
              if (levelIndex != i) {
                closeLevel(l, levelIndex);
              }
            }
          }
        }

        const _closeLevel = (l, i) => {
          const $checkbox = $(`#${navUniqId}-${l}-${i}`);
          const uniqid = $checkbox.val();
          const $li = $checkbox.parent('li');
          const $wrap = $li.closest('.nav-wrapper');

          $checkbox.prop('checked', false);
          $wrap.removeClass('sub-level-open');
          $li.removeClass('level-open');

          // this is not open anymore
          // if (_openLevels.indexOf(uniqid) !== -1) {
          //   _openLevels.splice(_openLevels.indexOf(uniqid), 1);
          // }
        };

        function closeLevel(l, i) {
          for (let level = l; level <= Object.keys(_indexes).length; level++) {
            if (level == l && typeof i !== 'undefined') {
              // close current level
              _closeLevel(l, i, true);
            }
            else {
              // then close all sub levels
              for (let index = 0; index < _indexes[level]; index++) {
                _closeLevel(level, index, level == l);
              }
            }
          }
        }

        // Public methods
        self.settings = (option) => {
          return option ? Settings[option] : Object.assign({}, Settings);
        };

        self.isOpen = () => $nav.hasClass(navOpenClass);

        self.open = openNav;

        self.close = closeNav;

        self.update = (options, updateDom) => {
          // clear updated array
          UpdatedSettings = [];

          if (typeof options === 'object') {
            // only get what's been actually updated
            for (let prop in options) {
              if (Settings[prop] !== options[prop]) {
                UpdatedSettings.push(prop);
              }
            }

            // merge to our settings
            Settings = $.extend({}, Settings, options);

            // reInit DOM
            initNav(true);
            createNavDom(true);
          }

          if (options === true || updateDom) {
            // reInit model and DOM
            initNav(true);
            createModel();
            createNavDom(true);
          }
        };
      };

      return this.each(Plugin);
    }
  });
})(jQuery, typeof window !== 'undefined' ? window : this);