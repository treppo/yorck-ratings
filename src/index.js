const csp = require('js-csp');
const _ = require('underscore');
const Maybe = require('data.maybe');
const Either = require('data.either');

const proxify = url => 'http://crossorigin.me/' + url;
const unproxify = url => url.replace(/http:\/\/crossorigin.me\//, '');

const Future = f => {
  return {
    await: (k) => f(k),
    map: g => Future(k => f(result => k(g(result)))),
    flatMap: h => Future(k => f(result => h(result).await(k)))
  }
};

const FutureEither = future => {
  return {
    future: future,
    await: future.await,
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
    const ratingsCount = $(page, '#overview-top .star-box-details > a').textContent;
    const normalizedRating = isNaN(rating) ? 0 : rating;

    return ImdbInfos(imdbTitle, normalizedRating, unproxify(page.URL), ratingsCount);
  };

  const searchPageEitherFuture = fetch(toSearchUrl(yorckInfos.title));

  return searchPageEitherFuture.flatMap(searchPage =>
    extractMoviePathname(searchPage)
      .map(pathname => fetch(imdbUrl + pathname))
      .map(pageFutureEither =>
        pageFutureEither.map(page => Movie(yorckInfos, extractMovieInfos(page))))
      .getOrElse(FutureEither(Future(_ => Movie(yorckInfos, ImdbInfos())))));
};

const showOnPage = (movie) => {
  const moviesEl = document.getElementById("movies");
  moviesEl.innerHTML = '';
  movie.forEach(movie =>
    moviesEl.innerHTML += `
      <li>
        <a href='${movie.imdb.url}' class="rating">
          ${movie.imdb.rating} (${movie.imdb.ratingsCount})
        </a> ${movie.imdb.title} –
        <a href='${movie.yorck.url}'>
          ${movie.yorck.title}
        </a>
      </li>`);
};

const showPageLoadError = errorMessage =>
  document.getElementById("errors").innerHTML += errorMessage;

const isSneakPreview = infos => infos.title.startsWith('Sneak');
const yorckInfosFutureEither = getYorckInfos();
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

yorckInfosFutureEither
  .map(yorckInfos =>
    _(yorckInfos)
      .reject(isSneakPreview)
      .map(getMovie))
  .map(searchResultFutureEithers =>
    searchResultFutureEithers
      .map(movieFutureEither =>
        movieFutureEither
          .await(movieEither =>
            movieEither
              .map(movies.add)
              .getOrElse(showPageLoadError))))
  .await(yorckInfosEither => yorckInfosEither.getOrElse(showPageLoadError));