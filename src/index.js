const csp = require('js-csp');
const _ = require('underscore');
const Maybe = require('data.maybe');
const Either = require('data.either');

const proxify = url => 'http://crossorigin.me/' + url;
const unproxify = url => url.replace(/http:\/\/crossorigin.me\//, '');

const future = function (f) {
  return {
    await: function (k) {
      return f(k);
    },
    map: function (g) {
      return future(function (k) {
        return f(function (x) {
          return k(g(x));
        });
      });
    },
    flatMap: function (g) {
      return future(function (k) {
        return f(function (x) {
          return g(x).await(k);
        });
      });
    }
  };
};

const fetch = url => f => {
  const req = new XMLHttpRequest();
  req.onload = () =>
    f(req.status == 200 ? Either.Right(req.responseXML) : Either.Left(req.statusText));
  req.open("GET", proxify(url), true);
  req.responseType = "document";
  req.overrideMimeType("text/html");
  req.send();
};

const yorckTitles = () => {
  const yorckFilmsUrl = "http://www.yorck.de/mobile/filme";
  const extractTitles = p => _.map(p.querySelectorAll('.films a'), el => el.textContent);
  const rotateArticle = title => {
    if (title.indexOf(', Der') !== -1) {
      return 'Der ' + title.replace(', Der', '')
    } else if (title.indexOf(', Die') !== -1) {
      return 'Die ' + title.replace(', Die', '')
    } else if (title.indexOf(', Das') !== -1) {
      return 'Das ' + title.replace(', Das', '')
    } else {
      return title
    }
  };
  const pageEitherFuture = future(fetch(yorckFilmsUrl));

  return pageEitherFuture
    .map(pageEither => pageEither.map(extractTitles))
    .map(titlesEither =>
      titlesEither.map(titles =>
        titles.map(rotateArticle)));
};

const getMovieWithRating = (yorckTitle) => {
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

  const extractMovieInfos = page => {
    const $ = (doc, selector) => doc.querySelector(selector) || {textContent: "n/a"};
    const imdbTitle = $(page, '#overview-top .header').textContent;
    const rating = $(page, '#overview-top .star-box-details strong').textContent;
    const ratingsCount = $(page, '#overview-top .star-box-details > a').textContent;

    return new MovieInfos(imdbTitle, rating, unproxify(page.URL), ratingsCount);
  };

  const searchPageEitherFuture = future(fetch(toSearchUrl(yorckTitle)));

  return searchPageEitherFuture.map(searchPageEither =>
      searchPageEither
        .map(searchPage =>
          extractMoviePathname(searchPage)
            .map(pathname => imdbUrl + pathname)
            .map(fetch)
            .map(future)
            .map(pageEitherFuture =>
              pageEitherFuture.map(pageEither =>
                pageEither
                  .map(extractMovieInfos)
                  .map(infos => [yorckTitle, infos])))
            .getOrElse(future(_ => [yorckTitle, new MovieInfos()]))));
};

const showOnPage = (entry) => {
  const moviesEl = document.getElementById("movies");
  const [yorckTitle, infos] = entry;
  moviesEl.innerHTML += `${yorckTitle} – ${infos.title} <a href='${infos.url}'>${infos.rating} (${infos.ratingsCount})</a><br>`
};

const showYorckPageLoadError = errorMessage =>
  document.getElementById("movies").innerHTML = errorMessage;

const isSneakPreview = title => title.startsWith('Sneak');
const titlesEitherFuture = yorckTitles();

titlesEitherFuture.await(titlesEither => {
  return titlesEither
    .map(titles => _.chain(titles)
      .reject(isSneakPreview)
      .map(getMovieWithRating)
      .map(entryEitherFutureEitherFuture =>
        entryEitherFutureEitherFuture.await(entryEitherFutureEither =>
          entryEitherFutureEither.map(entryEitherFuture =>
            entryEitherFuture.await(entryEither =>
              entryEither
                .map(showOnPage))))))
    .orElse(showYorckPageLoadError);
});
