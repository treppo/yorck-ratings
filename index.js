(global => {
  let unbox = f => p => p.then(f);
  let proxify = url => 'http://crossorigin.me/' + url;
  let unproxify = url => url.replace(/http:\/\/crossorigin.me\//, '');

  function MovieInfos(title, rating, url, ratingsCount) {
    this.title = title;
    this.rating = rating;
    this.url = url;
    this.ratingsCount = ratingsCount;
  }

  let fetch = (url) => {
    if (!url) { return Promise.resolve() };

    return new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      xhr.onload = () => {
        if (xhr.status == 200) { resolve(xhr.responseXML) }
        else { reject(Error(xhr.statusText)) } };
      xhr.onError = reject;
      xhr.open("GET", proxify(url));
      xhr.responseType = "document";
      xhr.overrideMimeType("text/html");
      xhr.send() }) };

  let getYorckMovies = () => {
    const url = "http://www.yorck.de/mobile/filme";
    let getMovieList = page => Array.prototype.slice.call(page.querySelectorAll('.films a')).map(_ => _.textContent)
    let fetchListOfMovies = () => fetch(url).then(getMovieList);

    return fetchListOfMovies() };

  let getImdbPages = movies => {
    const url = "http://www.imdb.com";
    const urls = movies.map(m => url + "/find?s=tt&q="+ encodeURIComponent(m));

    let getMovieUrl = page => {
      let a = page.querySelector('.findList .result_text a');
      if (!a) { return };
      return url + a.pathname };

    let fetchUrlsOfMovies = urls.map((url, i) => [movies[i], fetch(url).then(getMovieUrl)]);

    return fetchUrlsOfMovies };

  let getMovieWithRating = movies => {
    let $ = (page, selector) => {
      let el = page.querySelector(selector);
      let nullEl = { textContent: "n/a" }
      return el || nullEl
    };

    let extractInfos = page => {
      if (!page) { return ['n/a', 'n/a', ''] };
      let title = $(page, '#overview-top .header').textContent;
      let rating = $(page, '#overview-top .star-box-details strong').textContent;
      let ratingsCount = $(page, '#overview-top .star-box-details > a').textContent;
      return new MovieInfos(title, rating, unproxify(page.URL), ratingsCount) };

    return movies.map(([yorckTitle, urlP]) => [yorckTitle, urlP.then(fetch).then(extractInfos)]);
  };

  let moviesEl = document.getElementById("movies");
  let showOnPage = (yorckTitle, infos) => moviesEl.innerHTML += `${yorckTitle} – ${infos.title} <a href='${infos.url}'>${infos.rating} (${infos.ratingsCount})</a><br>`;

  let movies = getYorckMovies();
  let pages = movies.then(getImdbPages);
  let ratings = pages.then(getMovieWithRating);

  ratings.then(_ => _.map(([yorckTitle, infosP]) => infosP.then(i => showOnPage(yorckTitle, i))));
})(this);
