(global => {
  let unbox = f => p => p.then(f);
  let proxify = url => 'http://crossorigin.me/' + url;
  let unproxify = url => url.replace(/http:\/\/crossorigin.me\//, '');

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

    let fetchUrlsOfMovies = urls.map(url => fetch(url)).map(unbox(getMovieUrl));

    return fetchUrlsOfMovies };

  let getMovieWithRating = (moviesWithUrls) => {
    let extractInfos = page => {
      if (!page) { return };
      let title = page.querySelector('#overview-top .header').textContent;
      let rating = page.querySelector('#overview-top .star-box div').textContent;
      return [title, rating, unproxify(page.URL)] };
    return moviesWithUrls.map(unbox((url) => fetch(url))).map(unbox((page) => extractInfos(page)));
  };

  let moviesEl = document.getElementById("movies");
  let showOnPage = movie => moviesEl.innerHTML += `${movie[0]} <a href='${movie[2]}'>${movie[1]}</a><br>`;

  let movies = getYorckMovies();
  let pages = movies.then(getImdbPages);
  let ratings = pages.then(getMovieWithRating);

  ratings.then(v => v.map(unbox(showOnPage)));
})(this);
