const csp = require('js-csp');
const _ = require('underscore');
const Maybe = require('data.maybe');

const proxify = url => 'http://crossorigin.me/' + url;
const unproxify = url => url.replace(/http:\/\/crossorigin.me\//, '');

const fetch = (url) => {
  const ch = csp.chan();
  const req = new XMLHttpRequest();
  req.onload = () => {
    if (req.status == 200) { csp.putAsync(ch, req.responseXML); }
    else { csp.putAsync(ch, new Error(req.statusText)); }
  };
  req.open("GET", proxify(url), true);
  req.responseType = "document";
  req.overrideMimeType("text/html");
  req.send();
  return ch;
};

const yorckTitles = () => csp.go(function*() {
  const url = "http://www.yorck.de/mobile/filme";
  const page = yield csp.take(fetch(url));
  const els = page.querySelectorAll('.films a');

  return _.map(els, _ => _.textContent);
});

const getMovieWithRating = (yorckTitle) => csp.go(function*() {
  const imdbUrl = "http://www.imdb.com";
  const toSearchUrl = movie => `${imdbUrl}/find?s=tt&q=${encodeURIComponent(movie)}`;

  function MovieInfos(title = 'n/a', rating = 'n/a', url = '', ratingsCount = '') {
    this.title = title;
    this.rating = rating;
    this.url = url;
    this.ratingsCount = ratingsCount;
  }

  const extractMoviePathname = page => {
    const aEl = page.querySelector('.findList .result_text a');
    return Maybe.fromNullable(aEl).map(_ => _.pathname)
  };

  const extractMovieInfos = pageChannel => csp.go(function*() {
    const page = yield csp.take(pageChannel);

    const $ = (doc, selector) => doc.querySelector(selector) || { textContent: "n/a" };
    const imdbTitle = $(page, '#overview-top .header').textContent;
    const rating = $(page, '#overview-top .star-box-details strong').textContent;
    const ratingsCount = $(page, '#overview-top .star-box-details > a').textContent;

    return new MovieInfos(imdbTitle, rating, unproxify(page.URL), ratingsCount);
  });

  const searchPage = yield csp.take(fetch(toSearchUrl(yorckTitle)));

  return [yorckTitle, extractMoviePathname(searchPage)
    .map(pathname => imdbUrl + pathname)
    .map(fetch)
    .map(extractMovieInfos)
    .getOrElse(new MovieInfos())];
});

const showOnPage = (infoCh) => csp.go(function*() {
  const moviesEl = document.getElementById("movies");
  const [yorckTitle, infosCh] = yield csp.take(infoCh);
  const infos = yield csp.take(infosCh);
  moviesEl.innerHTML += `${yorckTitle} – ${infos.title} <a href='${infos.url}'>${infos.rating} (${infos.ratingsCount})</a><br>`;
});

csp.go(function*() {
  const isSneakPreview = title => title.startsWith('Sneak');

  _.chain(yield csp.take(yorckTitles()))
    .reject(isSneakPreview)
    .map(getMovieWithRating)
    .forEach(showOnPage);
});
