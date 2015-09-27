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
    flatMap: g => future(k => f(x => g(x).await(k)))
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

const YorckInfos = (title, url) => {
  return {
    title: title,
    url: url
  }
};

const ImdbInfos = (title = 'n/a', rating = 'n/a', url = '', ratingsCount = '') => {
  return {
    title: title,
    rating: rating,
    url: url,
    ratingsCount: ratingsCount
  }
};

const Movie = (yorckInfos, imdbInfos) => {
  return {
    yorck: yorckInfos,
    imdb: imdbInfos
  }
};

const getYorckInfos = () => {
  const yorckFilmsUrl = "http://www.yorck.de/mobile/filme";
  const rotateArticle = title => {
    if (title.includes(', Der')) {
      return 'Der ' + title.replace(', Der', '')
    } else if (title.includes(', Die')) {
      return 'Die ' + title.replace(', Die', '')
    } else if (title.includes(', Das')) {
      return 'Das ' + title.replace(', Das', '')
    } else {
      return title
    }
  };
  const extractInfos = p => _(p.querySelectorAll('.films a')).map(el => {
    return YorckInfos(rotateArticle(el.textContent), el.href) });

  const pageEitherFuture = fetch(yorckFilmsUrl);
  return pageEitherFuture
    .map(pageEither => pageEither.map(extractInfos))
};

const getMovieWithRating = (yorckInfos) => {
  const imdbUrl = "http://www.imdb.com";
  const toSearchUrl = movie => `${imdbUrl}/find?s=tt&q=${encodeURIComponent(movie)}`;

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

    return ImdbInfos(imdbTitle, normalizedRating, unproxify(page.URL), ratingsCount);
  };

  const searchPageEitherFuture = fetch(toSearchUrl(yorckInfos.title));

  return searchPageEitherFuture.map(searchPageEither =>
    searchPageEither
      .map(searchPage =>
        extractMoviePathname(searchPage)
          .map(pathname => fetch(imdbUrl + pathname))
          .map(pageEitherFuture =>
            pageEitherFuture.map(pageEither =>
              pageEither
                .map(page => Movie(yorckInfos, extractMovieInfos(page)))))
          .getOrElse(future(_ => Movie(yorckInfos, ImdbInfos())))));
};

const showOnPage = (movie) => {
  const moviesEl = document.getElementById("movies");
  moviesEl.innerHTML = '';
  movie.forEach(movie =>
    moviesEl.innerHTML += `
      <a href='${movie.imdb.url}'>
        ${movie.imdb.rating} (${movie.imdb.ratingsCount})
      </a> ${movie.imdb.title} –
      <a href='${movie.yorck.url}'>
        ${movie.yorck.title}
      </a><br>`);
};

const showPageLoadError = errorMessage =>
  document.getElementById("errors").innerHTML += errorMessage;

const isSneakPreview = infos => infos.title.startsWith('Sneak');
const titlesEitherFuture = getYorckInfos();

const movies = function () {
  let list = [];
  return {
    add: movie => {
      list.push(movie);
      list = _(list).sortBy(m => m.imdb.rating).reverse();
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
