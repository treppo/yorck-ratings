(global => {
  let fetch = (url) => {
    return new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      xhr.onload = () => {
        if (xhr.status == 200) { resolve(xhr.responseXML) }
        else { reject(Error(xhr.statusText)) } };
      xhr.onError = () => reject("XHR Error");
      xhr.open("GET", url);
      xhr.responseType = "document";
      xhr.overrideMimeType("text/html");
      xhr.send() }) };

  let getYorckMovies = () => {
    const url = "http://crossorigin.me/http://www.yorck.de/mobile/filme";
    let getMovieList = page => Array.prototype.slice.call(page.querySelectorAll('.films a')).map(_ => _.textContent)
    let fetchListOfMovies = () => fetch(url).then(getMovieList);

    return fetchListOfMovies() };

  // let zip = () => {
  //   let args = Array.from(arguments);
  //
  //   return args[0].map((_, i) => args.map(array => array[i]));
  // };

  let getImdbPages = movies => {
    const url = "http://crossorigin.me/http://www.imdb.com";
    const urls = movies.map(m => url + "/find?s=tt&q="+ encodeURIComponent(m));

    let getMovieUrl = page => {
      let a = page.querySelector('.findList .result_text a');
      if (!a) { return null };
      return url + a.pathname };

    let fetchUrlsOfMovies = urls.map(url => fetch(url).then(getMovieUrl, console.error));

    return fetchUrlsOfMovies };

  let getMovieWithRating = pageUrls => {
    let fetchPage = urlPromise => {
      return urlPromise.then(url => { if (url) { return fetch(url) }})
    };
    let extractInfos = page => {
      if (!page) { return null };
      let title = page.querySelector('#overview-top .header').textContent;
      let rating = page.querySelector('#overview-top .star-box div').textContent;
      return title + ' ' + rating };
    return Promise.all(pageUrls.map(fetchPage).map(pagePromise => pagePromise.then(extractInfos)));
  }

  let showOnPage = () => {
    let moviesEl = document.getElementById("movies");
    let args = Array.from(arguments);

    moviesEl.textContent = args; };

  let movies = getYorckMovies();
  let pages = movies.then(getImdbPages);
  let ratings = pages.then(getMovieWithRating);

  ratings.then(showOnPage);
})(this);
