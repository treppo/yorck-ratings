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

  async function yorckTitles() {
    const url = "http://www.yorck.de/mobile/filme";
    let page = await fetch(url);
    let els = page.querySelectorAll('.films a');
    let movieList = [].slice.call(els).map(_ => _.textContent)

    return movieList
  };

  async function getMovieWithRating(yorckTitle) {
    const imdbUrl = "http://www.imdb.com";

    let getMovieUrl = page => {
      let a = page.querySelector('.findList .result_text a');
      if (!a) { return '' };
      return imdbUrl + a.pathname
    };

    let toSearchUrl = movie => `${imdbUrl}/find?s=tt&q=${encodeURIComponent(movie)}`;
    let searchPage = await fetch(toSearchUrl(yorckTitle));
    let url = getMovieUrl(searchPage);

    let $ = (page, selector) => {
      let el = page.querySelector(selector);
      let nullEl = { textContent: "n/a" }
      return el || nullEl
    };

    let moviePage = await fetch(url);

    let imdbTitle = $(moviePage, '#overview-top .header').textContent;
    let rating = $(moviePage, '#overview-top .star-box-details strong').textContent;
    let ratingsCount = $(moviePage, '#overview-top .star-box-details > a').textContent;

    if (!moviePage) { return ['n/a', 'n/a', '', ''] };
    return new MovieInfos(imdbTitle, rating, unproxify(moviePage.URL), ratingsCount)
  };

  (async function() {
    let moviesEl = document.getElementById("movies");
    let showOnPage = (yorckTitle, infos) => moviesEl.innerHTML += `${yorckTitle} – ${infos.title} <a href='${infos.url}'>${infos.rating} (${infos.ratingsCount})</a><br>`;

    let titles = await yorckTitles();
    let info = titles.map(getMovieWithRating);
    info.forEach(async function(i){ showOnPage('', await i); });
  })()
})(this);
