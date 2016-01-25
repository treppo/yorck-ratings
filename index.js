const _ = require('underscore');
const Maybe = require('data.maybe');
const Either = require('data.either');

const proxify = url => '//crossorigin.me/' + url;
const unproxify = url => url.replace(/http(s)?:\/\/crossorigin.me\//, '');

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
    getOrLeftMap: f => future.map(either => either.isLeft ? either.leftMap(f) : either.get()).get(),
    map: f => FutureEither(future.map(either =>
      either.isLeft ? either : Either.Right(f(either.get())))),
    flatMap: f => {
      const result = future.flatMap(either =>
        either.isLeft ? Future(g => g(either)) : f(either.get()).future);
      return FutureEither(result)
    }
  }
};

const request = url =>
  FutureEither(Future(f => {
    const req = new XMLHttpRequest();
    const handleError = () => Either.Left(`Error ${req.status} – ${req.statusText} while loading ${url}`);
    req.onload = () =>
      f(req.status == 200 ? Either.Right(req.responseXML) : handleError());
    req.onerror = handleError;
    req.open("GET", proxify(url), true);
    req.responseType = "document";
    req.overrideMimeType("text/html");
    req.send();
  }));

const YorckInfos = (title, url) => {
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

  const remove2And3D = title => {
    if (title.includes('2D')) {
      return title.replace('2D', '')
    } else if (title.includes('3D')) {
      return title.replace('3D', '')
    } else {
      return title
    }
  };

  const correctTitle = _.compose(remove2And3D, rotateArticle);

  return {
    title: rotateArticle(title),
    searchableTitle: correctTitle(title),
    url: url
  }
};

const Movie = (yorckInfos, imdbInfos) => {
  return {
    yorck: yorckInfos,
    imdb: imdbInfos
  }
};

const YorckPage = doc => {
  return {
    movieAnchors: _(doc.querySelectorAll('.movie-details a'))
  }
};

const ImdbSearchPage = doc => {
  return {
    moviePathMaybe: Maybe.fromNullable(doc.querySelector('.findList .findResult a'))
      .map(a => a.pathname)
  };
};

const ImdbDetailPage = doc => {
  const $ = (selector) => doc.querySelector(selector) || {textContent: "n/a"};

  return {
    url: unproxify(doc.URL),
    rating: (() => {
      const rating = parseFloat($('span[itemprop="ratingValue"]').textContent);
      return isNaN(rating) ? 0 : rating
    })(),
    ratingsCount: $('span[itemprop="ratingCount"]').textContent.trim(),
    title: $('*[itemprop="name"]').textContent
  }
};

const getYorckInfos = () => {
  const yorckFilmsUrl = "https://www.yorck.de/filme?filter_today=true";

  const extractInfos = yp =>
    yp.movieAnchors.map(({textContent, href}) => YorckInfos(textContent, href));

  return request(yorckFilmsUrl)
    .map(YorckPage)
    .map(extractInfos)
};

const getMovie = (yorckInfos) => {
  const imdbUrl = "http://www.imdb.com";
  const searchUrl = `${imdbUrl}/find?q=${encodeURIComponent(yorckInfos.searchableTitle)}`;

  const searchPageEitherFuture = request(searchUrl);

  return searchPageEitherFuture.flatMap(searchPage =>
    ImdbSearchPage(searchPage).moviePathMaybe
      .map(pathname => request(imdbUrl + pathname))
      .getOrElse(FutureEither(Future(f =>
        f(Either.Left(`Couldn't find movie "${yorckInfos.title}" on Imdb at ${searchUrl}`)))))
      .map(detailPage => Movie(yorckInfos, ImdbDetailPage(detailPage))));
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
  document.getElementById("errors").innerHTML += `<p>${errorMessage}</p>`;

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

getYorckInfos()
  .map(yorckInfos =>
    _(yorckInfos)
      .reject(isSneakPreview)
      .map(getMovie)
      .map(movieFutureEither =>
        movieFutureEither
          .map(movie => { movies.add(movie); return movie })
          .getOrLeftMap(showPageLoadError)))
  .getOrLeftMap(showPageLoadError);