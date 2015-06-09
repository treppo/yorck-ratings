(global => {
  const proxify = url => 'http://crossorigin.me/' + url;
  const unproxify = url => url.replace(/http:\/\/crossorigin.me\//, '');

  function MovieInfos(title, rating, url, ratingsCount) {
    this.title = title;
    this.rating = rating;
    this.url = url;
    this.ratingsCount = ratingsCount;
  }

  const fetch = (url) => {
    if (!url) { return Promise.resolve() };

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
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
    const page = await fetch(url);
    const els = page.querySelectorAll('.films a');
    const movieList = [].slice.call(els).map(_ => _.textContent)

    return movieList
  };

  async function getMovieWithRating(yorckTitle) {
    const imdbUrl = "http://www.imdb.com";

    const getMovieUrl = page => {
      const a = page.querySelector('.findList .result_text a');
      if (!a) { return '' };
      return imdbUrl + a.pathname
    };

    const toSearchUrl = movie => `${imdbUrl}/find?s=tt&q=${encodeURIComponent(movie)}`;
    const searchPage = await fetch(toSearchUrl(yorckTitle));
    const url = getMovieUrl(searchPage);

    const $ = (page, selector) => {
      const el = page.querySelector(selector);
      const nullEl = { textContent: "n/a" }
      return el || nullEl
    };

    const moviePage = await fetch(url);

    const imdbTitle = $(moviePage, '#overview-top .header').textContent;
    const rating = $(moviePage, '#overview-top .star-box-details strong').textContent;
    const ratingsCount = $(moviePage, '#overview-top .star-box-details > a').textContent;

    if (!moviePage) { return ['n/a', 'n/a', '', ''] };
    return new MovieInfos(imdbTitle, rating, unproxify(moviePage.URL), ratingsCount)
  };

  (async function() {
    const moviesEl = document.getElementById("movies");
    const showOnPage = (yorckTitle, infos) => moviesEl.innerHTML += `${yorckTitle} – ${infos.title} <a href='${infos.url}'>${infos.rating} (${infos.ratingsCount})</a><br>`;
    const isNotSneakPreview = title => !title.startsWith('Sneak');

    (await yorckTitles())
      .filter(isNotSneakPreview)
      .map(t => [t, getMovieWithRating(t)])
      .forEach(async function([title, i]){ showOnPage(title, await i); });
  })()
})(this);
