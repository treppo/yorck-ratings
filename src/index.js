const csp = require('js-csp');
const _ = require('underscore');
const Maybe = require('data.maybe');
const Either = require('data.either');

const proxify = url => 'http://crossorigin.me/' + url;
const unproxify = url => url.replace(/http:\/\/crossorigin.me\//, '');

const future = f => {
  return {
    await: k => f(k),
    map: g => future(k => f(x => k(g(x)))),
    flatMap: g => future(k => f(x => g(x).await(k))),
    chain: g => g(f)
  }
};

const fetch = url => future(f => {
  const req = new XMLHttpRequest();
  req.onload = () =>
    f(req.status == 200 ? Either.Right(req.responseXML) : Either.Left(req.statusText));
  req.open("GET", proxify(url), true);
  req.responseType = "document";
  req.overrideMimeType("text/html");
  req.send();
});

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
  const pageEitherFuture = fetch(yorckFilmsUrl);

  return pageEitherFuture
    .map(pageEither => pageEither.map(extractTitles))
    .map(titlesEither =>
      titlesEither.map(titles =>
        titles.map(rotateArticle)));
};

const getMovieWithRating = (yorckTitle) => {
  const imdbUrl = "http://www.imdb.com";
  const toSearchUrl = movie => `${imdbUrl}/find?s=tt&q=${encodeURIComponent(movie)}`;

  function ImdbInfos(title = 'n/a', rating = 'n/a', url = '', ratingsCount = '') {
    this.title = title;
    this.rating = rating;
    this.url = url;
    this.ratingsCount = ratingsCount;
  }

  function Movie(yorckTitle, imdbInfos) {
    this.yorckTitle = yorckTitle;
    this.imdbTitle = imdbInfos.title;
    this.rating = imdbInfos.rating;
    this.imdbUrl = imdbInfos.url;
    this.ratingsCount = imdbInfos.ratingsCount;
  }

  const extractMoviePathname = page => {
    const aEl = page.querySelector('.findList .result_text a');
    return Maybe.fromNullable(aEl).map(_ => _.pathname)
  };

  const extractMovieInfos = page => {
    const $ = (doc, selector) => doc.querySelector(selector) || {textContent: "n/a"};
    const imdbTitle = $(page, '#overview-top .header').textContent;
    const rating = parseFloat($(page, '#overview-top .star-box-details strong').textContent);
    const ratingsCount = $(page, '#overview-top .star-box-details > a').textContent;
    const normalizedRating = isNaN(rating) ? 0 : rating;

    return new ImdbInfos(imdbTitle, normalizedRating, unproxify(page.URL), ratingsCount);
  };

  const searchPageEitherFuture = fetch(toSearchUrl(yorckTitle));

  return searchPageEitherFuture.map(searchPageEither =>
    searchPageEither
      .map(searchPage =>
        extractMoviePathname(searchPage)
          .map(pathname => fetch(imdbUrl + pathname))
          .map(pageEitherFuture =>
            pageEitherFuture.map(pageEither =>
              pageEither
                .map(page => new Movie(yorckTitle, extractMovieInfos(page)))))
          .getOrElse(future(_ => new Movie(yorckTitle, new ImdbInfos())))));
};

const showOnPage = (movie) => {
  const moviesEl = document.getElementById("movies");
  moviesEl.innerHTML = '';
  movie.forEach(movie =>
    moviesEl.innerHTML +=
      `<a href='${movie.imdbUrl}'>${movie.rating} (${movie.ratingsCount})</a> ${movie.yorckTitle} – ${movie.imdbTitle}<br>`);
};

const showPageLoadError = errorMessage =>
  document.getElementById("errors").innerHTML += errorMessage;

const isSneakPreview = title => title.startsWith('Sneak');
const titlesEitherFuture = yorckTitles();

const movies = function () {
  let list = [];
  return {
    add: movie => {
      list.push(movie);
      list = _(list).sortBy('rating').reverse();
      showOnPage(list)
    }
  }
}();

titlesEitherFuture.await(titlesEither =>
  titlesEither
    .map(titles => _.chain(titles)
      .reject(isSneakPreview)
      .map(getMovieWithRating)
      .map(searchResultFuture =>
        searchResultFuture.await(searchResultEither =>
          searchResultEither
            .map(movieFuture =>
              movieFuture.await(movieEither =>
                movieEither
                  .map(movies.add)
                  .orElse(showPageLoadError)))
            .orElse(showPageLoadError))))
    .orElse(showPageLoadError));
