const csp = require('js-csp');
const _ = require('underscore');
const Maybe = require('data.maybe');
const Either = require('data.either');

const proxify = url => 'http://crossorigin.me/' + url;
const unproxify = url => url.replace(/http:\/\/crossorigin.me\//, '');

const Future = f => {
  return {
    get: () => f(x => x),
    map: g => Future(k => f(result => k(g(result)))),
    flatMap: h => Future(k => f(result => h(result).map(k).get()))
  }
};

const FutureEither = future => {
  return {
    future: future,
    get: future.get,
    getOrElse: f => future.map(x => x.getOrElse(f)).get(),
    map: f => FutureEither(future.map(either =>
      either.isLeft ? either : Either.Right(f(either.get())))),
    flatMap: f => {
      const result = future.flatMap(either => {
        return either.isLeft ? Future(_ => either) : f(either.get()).future
      });
      return FutureEither(result)
    }
  }
};

const fetch = url => FutureEither(Future(f => {
  const req = new XMLHttpRequest();
  req.onload = () =>
    f(req.status == 200 ? Either.Right(req.responseXML) : Either.Left(req.statusText));
  req.open("GET", proxify(url), true);
  req.responseType = "document";
  req.overrideMimeType("text/html");
  req.send();
}));

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
    return YorckInfos(rotateArticle(el.textContent), el.href)
  });

  const pageEitherFuture = fetch(yorckFilmsUrl);
  return pageEitherFuture.map(page => extractInfos(page))
};

const getMovie = (yorckInfos) => {
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
    const ratingsCount = $(page, '#overview-top .star-box-details > a').textContent.trim();
    const normalizedRating = isNaN(rating) ? 0 : rating;

    return ImdbInfos(imdbTitle, normalizedRating, unproxify(page.URL), ratingsCount);
  };

  const searchPageEitherFuture = fetch(toSearchUrl(yorckInfos.title));

  return searchPageEitherFuture.flatMap(searchPage =>
    extractMoviePathname(searchPage)
      .map(pathname => fetch(imdbUrl + pathname))
      .map(pageFutureEither =>
        pageFutureEither.map(page => Movie(yorckInfos, extractMovieInfos(page))))
      .getOrElse(FutureEither(Future(_ => Either.Left("Couldn't find movie on Imdb")))));
};

const showOnPage = (movies) => {
  const moviesTable = document.getElementById("movies");
  let moviesHtml = '';
  movies.forEach(movie =>
    moviesHtml += `
      <tr>
        <td>
          ${movie.imdb.rating} (${movie.imdb.ratingsCount})
        </td>
        <td>
          <a href="${movie.imdb.url}">
            ${movie.imdb.title}
          </a>
        </td>
        <td>
          <a href="${movie.yorck.url}">
            ${movie.yorck.title}
          </a>
        </td>
      </tr>`);
  moviesTable.innerHTML = moviesHtml;
};

const showPageLoadError = errorMessage =>
  document.getElementById("errors").innerHTML += errorMessage;

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

const isSneakPreview = infos => infos.title.startsWith('Sneak');

const getMoviesFromYorckInfos = yorckInfos =>
    _(yorckInfos)
      .reject(isSneakPreview)
      .map(getMovie);

// TODO simplify by introducing ListFutureEither
getYorckInfos()
  .map(getMoviesFromYorckInfos)
  .map(movieFutureEithers =>
    movieFutureEithers
      .map(movieFutureEither =>
        movieFutureEither
          .map(movie => { movies.add(movie); return movie })
          .get()))
  .getOrElse(showPageLoadError);