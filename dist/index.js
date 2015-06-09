'use strict';

function _slicedToArray(arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }

(function (global) {
  var proxify = function proxify(url) {
    return 'http://crossorigin.me/' + url;
  };
  var unproxify = function unproxify(url) {
    return url.replace(/http:\/\/crossorigin.me\//, '');
  };

  function MovieInfos(title, rating, url, ratingsCount) {
    this.title = title;
    this.rating = rating;
    this.url = url;
    this.ratingsCount = ratingsCount;
  }

  var fetch = function fetch(url) {
    if (!url) {
      return Promise.resolve();
    };

    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.onload = function () {
        if (xhr.status == 200) {
          resolve(xhr.responseXML);
        } else {
          reject(Error(xhr.statusText));
        }
      };
      xhr.onError = reject;
      xhr.open('GET', proxify(url));
      xhr.responseType = 'document';
      xhr.overrideMimeType('text/html');
      xhr.send();
    });
  };

  function yorckTitles() {
    var url, page, els, movieList;
    return regeneratorRuntime.async(function yorckTitles$(context$2$0) {
      while (1) switch (context$2$0.prev = context$2$0.next) {
        case 0:
          url = 'http://www.yorck.de/mobile/filme';
          context$2$0.next = 3;
          return regeneratorRuntime.awrap(fetch(url));

        case 3:
          page = context$2$0.sent;
          els = page.querySelectorAll('.films a');
          movieList = [].slice.call(els).map(function (_) {
            return _.textContent;
          });
          return context$2$0.abrupt('return', movieList);

        case 7:
        case 'end':
          return context$2$0.stop();
      }
    }, null, this);
  };

  function getMovieWithRating(yorckTitle) {
    var imdbUrl, getMovieUrl, toSearchUrl, searchPage, url, $, moviePage, imdbTitle, rating, ratingsCount;
    return regeneratorRuntime.async(function getMovieWithRating$(context$2$0) {
      while (1) switch (context$2$0.prev = context$2$0.next) {
        case 0:
          imdbUrl = 'http://www.imdb.com';

          getMovieUrl = function getMovieUrl(page) {
            var a = page.querySelector('.findList .result_text a');
            if (!a) {
              return '';
            };
            return imdbUrl + a.pathname;
          };

          toSearchUrl = function toSearchUrl(movie) {
            return '' + imdbUrl + '/find?s=tt&q=' + encodeURIComponent(movie);
          };

          context$2$0.next = 5;
          return regeneratorRuntime.awrap(fetch(toSearchUrl(yorckTitle)));

        case 5:
          searchPage = context$2$0.sent;
          url = getMovieUrl(searchPage);

          $ = function $(page, selector) {
            var el = page.querySelector(selector);
            var nullEl = { textContent: 'n/a' };
            return el || nullEl;
          };

          context$2$0.next = 10;
          return regeneratorRuntime.awrap(fetch(url));

        case 10:
          moviePage = context$2$0.sent;
          imdbTitle = $(moviePage, '#overview-top .header').textContent;
          rating = $(moviePage, '#overview-top .star-box-details strong').textContent;
          ratingsCount = $(moviePage, '#overview-top .star-box-details > a').textContent;

          if (moviePage) {
            context$2$0.next = 16;
            break;
          }

          return context$2$0.abrupt('return', ['n/a', 'n/a', '', '']);

        case 16:
          ;
          return context$2$0.abrupt('return', new MovieInfos(imdbTitle, rating, unproxify(moviePage.URL), ratingsCount));

        case 18:
        case 'end':
          return context$2$0.stop();
      }
    }, null, this);
  };

  (function callee$1$0() {
    var moviesEl, showOnPage, titles, info;
    return regeneratorRuntime.async(function callee$1$0$(context$2$0) {
      while (1) switch (context$2$0.prev = context$2$0.next) {
        case 0:
          moviesEl = document.getElementById('movies');

          showOnPage = function showOnPage(yorckTitle, infos) {
            return moviesEl.innerHTML += '' + yorckTitle + ' – ' + infos.title + ' <a href=\'' + infos.url + '\'>' + infos.rating + ' (' + infos.ratingsCount + ')</a><br>';
          };

          context$2$0.next = 4;
          return regeneratorRuntime.awrap(yorckTitles());

        case 4:
          titles = context$2$0.sent;
          info = titles.map(function (t) {
            return [t, getMovieWithRating(t)];
          });

          info.forEach(function callee$2$0(_ref) {
            var _ref2 = _slicedToArray(_ref, 2);

            var title = _ref2[0];
            var i = _ref2[1];
            return regeneratorRuntime.async(function callee$2$0$(context$3$0) {
              while (1) switch (context$3$0.prev = context$3$0.next) {
                case 0:
                  context$3$0.next = 2;
                  return regeneratorRuntime.awrap(i);

                case 2:
                  context$3$0.t0 = context$3$0.sent;
                  showOnPage(title, context$3$0.t0);

                case 4:
                case 'end':
                  return context$3$0.stop();
              }
            }, null, this);
          });

        case 7:
        case 'end':
          return context$2$0.stop();
      }
    }, null, this);
  })();
})(undefined);

//# sourceMappingURL=index.js.map