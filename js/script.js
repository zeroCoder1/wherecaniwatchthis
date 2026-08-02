var jsonObj = ""
var providers = "";
var uniquePackages;
var selectedCountry = "IN"; // Track selected country
var isUserSelectedCountry = false; // Track if user manually selected a country
var currentShowDetails = null;
var activeSeasonId = null;
var isSeasonLoading = false;
var suggestionCache = {};

function setModalLoadingState(isLoading) {
  var modalContent = document.querySelector(".modal-content");
  if (modalContent) {
    if (isLoading) {
      modalContent.classList.add("is-loading");
    } else {
      modalContent.classList.remove("is-loading");
    }
  }

  isSeasonLoading = isLoading;
}

function endSeasonLoadingWithDelay() {
  setTimeout(function () {
    setModalLoadingState(false);
  }, 140);
}

function setActiveSeasonChip(seasonId) {
  var chips = document.querySelectorAll("#season-browser .season-chip");
  for (var i = 0; i < chips.length; i++) {
    var isShowChip = chips[i].getAttribute("data-view") === "show";
    var isActive = (isShowChip && !seasonId) || (!isShowChip && chips[i].getAttribute("data-season-id") === seasonId);

    if (isActive) {
      chips[i].classList.add("active");
    } else {
      chips[i].classList.remove("active");
    }
  }
}

function animateChipTap(chipElement) {
  if (!chipElement || typeof chipElement.animate !== "function") {
    return;
  }

  chipElement.animate([
    { transform: "translateY(0) scale(1)" },
    { transform: "translateY(1px) scale(0.995)" },
    { transform: "translateY(0) scale(1)" }
  ], {
    duration: 180,
    easing: "cubic-bezier(0.2, 0.7, 0.2, 1)",
    fill: "none"
  });
}

function animateContentUpdate() {
  var animatedSelectors = [
    ".modal-title",
    ".description",
    ".crossfade",
    ".imdb",
    ".rt",
    ".switch-toggle",
    "#provider-list",
    ".video-gallery"
  ];

  for (var i = 0; i < animatedSelectors.length; i++) {
    var element = document.querySelector(animatedSelectors[i]);
    if (!element) {
      continue;
    }

    element.classList.remove("ui-fade-in");
    void element.offsetWidth;
    element.classList.add("ui-fade-in");
  }
}

function scrollModalToTop() {
  var modalElement = document.getElementById("myModal");
  if (modalElement) {
    modalElement.scrollTo({ top: 0, behavior: "smooth" });
  }

  var modalContent = document.querySelector(".modal-content");
  if (modalContent) {
    modalContent.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

$(document).ready(function () {
  // Load saved country from localStorage on page load
  var savedCountry = localStorage.getItem("selectedCountry");
  if (savedCountry) {
    selectedCountry = savedCountry;
    isUserSelectedCountry = (selectedCountry !== "IN");
    $("#country-selector").val(selectedCountry);
  }
  
  // Country selector change event
  $("#country-selector").on("change", function() {
    selectedCountry = $(this).val();
    isUserSelectedCountry = (selectedCountry !== "IN");
    // Save to localStorage
    localStorage.setItem("selectedCountry", selectedCountry);

    // If modal is currently open, force a full reload so the same title is re-fetched
    // using the newly selected country context.
    if (modal && modal.style.display === 'block') {
      window.location.reload();
    }
  });

  $("#dataList").on("click", "li", function () {
    var id = $(this).attr("data-id");
    var title = $(this).find("p").text().split("(")[0].trim(); // Extract title
    
    // Update URL first, then fetch details
    updateURL(id, title);
    fetchMovieDetails(id);
  });

  $("#modal-suggestions").on("click", "li", function () {
    var id = $(this).attr("data-id");
    var title = $(this).find("p").text().split("(")[0].trim();

    if (!id) {
      return;
    }

    scrollModalToTop();
    updateURL(id, title);
    fetchMovieDetails(id);
  });

  // Handle direct URL access and browser back/forward (with slight delay to ensure DOM is ready)
  setTimeout(function() {
    handleURLRouting();
  }, 100);
  
  // Listen for browser back/forward button
  window.addEventListener('popstate', function(event) {
    handleURLRouting();
  });
  
  // Listen for Escape key to close modal
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && modal && modal.style.display === 'block') {
      closeModalAndResetURL();
    }
  });

  // Handle season chip clicks in modal
  $(document).on("click", ".season-chip", function () {
    if (isSeasonLoading) {
      return;
    }

    animateChipTap(this);

    if ($(this).hasClass("active")) {
      return;
    }

    var viewType = $(this).attr("data-view");
    if (viewType === "show") {
      if (!currentShowDetails) {
        return;
      }

      activeSeasonId = null;
      setActiveSeasonChip(null);
      updateModalContent(currentShowDetails, false);
      return;
    }

    var seasonId = $(this).attr("data-season-id");
    if (!seasonId || seasonId === activeSeasonId) {
      return;
    }

    var previousSeasonId = activeSeasonId;
    activeSeasonId = seasonId;
    setActiveSeasonChip(seasonId);
    fetchSeasonDetails(seasonId, previousSeasonId);
  });
});

var HttpClient = function () {
  this.get = function (aUrl, aCallback, country, errorCallback) {
    var countryCode = country || "IN"; // Default to India if no country specified
    var anHttpRequest = new XMLHttpRequest();
    anHttpRequest.onreadystatechange = function () {
      if (anHttpRequest.readyState == 4 && anHttpRequest.status == 200) {
        document.querySelector(".headline").innerHTML = "Where can I watch this";
        aCallback(anHttpRequest.responseText);
      } else if (anHttpRequest.readyState == 4 && anHttpRequest.status == 404) {
        if (errorCallback) {
          errorCallback();
        } else {
          document.querySelector(".headline").innerHTML = "AW SNAP!!";
          var ddlCustomers = $("#dataList");
          ddlCustomers.empty();
        }
      } else if (anHttpRequest.readyState == 4) {
        if (errorCallback) {
          errorCallback();
        } else {
          document.querySelector(".headline").innerHTML = "Let's do this";
        }
      }
    }

    anHttpRequest.open("GET", aUrl, true);
    anHttpRequest.setRequestHeader("X-language", "en");
    anHttpRequest.setRequestHeader("X-country", countryCode);
    anHttpRequest.setRequestHeader("Cache-Control", "no-cache");
    anHttpRequest.send(null);
  }
}

// Helper function to check if providers object is empty or has no streaming options
function hasValidProviders(providers) {
  if (!providers) return false;
  
  var hasAnyProviders = false;
  var providerTypes = ["flatrate", "buy", "rent"];
  
  for (var i = 0; i < providerTypes.length; i++) {
    if (providers[providerTypes[i]] && providers[providerTypes[i]].length > 0) {
      hasAnyProviders = true;
      break;
    }
  }
  
  return hasAnyProviders;
}

// Helper function to get country name from country code
function getCountryName(countryCode) {
  var countryNames = {
    "IN": "India",
    "US": "United States",
    "GB": "United Kingdom",
    "CA": "Canada"
  };
  return countryNames[countryCode] || countryCode;
}

function fetchMovieDetails(id) {
  jsonObj = ""
  
  // Show loading state
  document.querySelector(".headline").innerHTML = "Loading...";
  
  // If user selected a specific country, only search in that country (no fallback)
  if (isUserSelectedCountry) {
    fetchMovieDetailsForCountry(id, selectedCountry);
  } else {
    // Default India mode: try multiple countries with fallback
    fetchMovieDetailsWithFallback(id, ["IN", "US", "GB", "CA"], 0);
  }
}

function fetchMovieDetailsForCountry(id, country) {
  var client = new HttpClient();
  
  client.get("https://s.prod.supr.ninja/sw/v2/title/" + id + "/detail", function (response) {
    var responseData = JSON.parse(response);
    
    if (hasValidProviders(responseData.providers)) {
      // Found providers in selected country
      jsonObj = responseData;
      jsonObj.sourceCountry = country;
      jsonObj.isUserSelectedCountry = true; // Flag to indicate user selected this country
      showModal(jsonObj);
    } else {
      // No providers in selected country
      document.querySelector(".headline").innerHTML = "Content not available";
      jsonObj = {
        title_content: { title: "Content not available" },
        summary: "This content is not available for streaming in " + getCountryName(country) + ".",
        providers: {},
        title_backdrops: [],
        scores: { imdbScore: "N/A", tmdbScore: "N/A" },
        clips: [],
        sourceCountry: country,
        isUserSelectedCountry: true
      };
      showModal(jsonObj);
    }
  }, country, function() {
    // Error callback - show error message
    document.querySelector(".headline").innerHTML = "Unable to load content";
    if (modal && modal.style.display === 'block') {
      closeModalAndResetURL();
    }
  });
}

function fetchMovieDetailsWithFallback(id, countries, countryIndex) {
  if (countryIndex >= countries.length) {
    // No providers found in any country, show modal with empty providers
    document.querySelector(".headline").innerHTML = "Content not found";
    jsonObj = {
      title_content: { title: "Content not available" },
      summary: "This content is not available for streaming in supported regions.",
      providers: {},
      title_backdrops: [],
      scores: { imdbScore: "N/A", tmdbScore: "N/A" },
      clips: [],
      sourceCountry: null // No country had providers
    };
    showModal(jsonObj);
    return;
  }
  
  var client = new HttpClient();
  var currentCountry = countries[countryIndex];
  
  client.get("https://s.prod.supr.ninja/sw/v2/title/" + id + "/detail", function (response) {
    var responseData = JSON.parse(response);
    
    if (hasValidProviders(responseData.providers)) {
      // Found providers in current country, use this data
      jsonObj = responseData;
      jsonObj.sourceCountry = currentCountry; // Track which country provided the data
      showModal(jsonObj);
    } else {
      // No providers in current country, try next country
      fetchMovieDetailsWithFallback(id, countries, countryIndex + 1);
    }
  }, currentCountry, function() {
    // Error callback - try next country if available
    if (countryIndex + 1 < countries.length) {
      fetchMovieDetailsWithFallback(id, countries, countryIndex + 1);
    } else {
      // All countries failed, show error
      document.querySelector(".headline").innerHTML = "Unable to load content";
      // Close modal if it was opened from URL
      if (modal && modal.style.display === 'block') {
        closeModalAndResetURL();
      }
    }
  });
}

function getSortedSeasons(details) {
  if (!details || !Array.isArray(details.seasons)) {
    return [];
  }

  return details.seasons.slice().sort(function (a, b) {
    return (a.season_number || 0) - (b.season_number || 0);
  });
}

function renderSeasonBrowser(showDetails) {
  var seasonBrowser = document.querySelector("#season-browser");
  if (!seasonBrowser) {
    return;
  }

  if (!showDetails || showDetails.object_type !== "SHOW") {
    seasonBrowser.style.display = "none";
    seasonBrowser.innerHTML = "";
    return;
  }

  var seasons = getSortedSeasons(showDetails);
  if (seasons.length === 0) {
    seasonBrowser.style.display = "none";
    seasonBrowser.innerHTML = "";
    return;
  }

  var chips = "";
  var showChipClass = "season-chip";
  if (!activeSeasonId) {
    showChipClass += " active";
  }
  chips += "<button class='" + showChipClass + "' data-view='show'>Show</button>";

  for (var i = 0; i < seasons.length; i++) {
    var chipClass = "season-chip";
    if (activeSeasonId === seasons[i].id) {
      chipClass += " active";
    }

    chips += "<button class='" + chipClass + "' data-season-id='" + seasons[i].id + "'>Season " + seasons[i].season_number + "</button>";
  }

  seasonBrowser.innerHTML = chips;
  seasonBrowser.style.display = "flex";
}

function renderTrailers(clips) {
  var videoContainer = document.querySelector("#video");
  var videoGallery = document.querySelector(".video-gallery");
  if (!videoContainer) {
    return;
  }

  if (!Array.isArray(clips) || clips.length === 0) {
    videoContainer.innerHTML = "";
    if (videoGallery) {
      videoGallery.style.display = "none";
    }
    return;
  }

  if (videoGallery) {
    videoGallery.style.display = "block";
  }

  var seenIds = {};
  var clipHtml = "";
  var rendered = 0;

  for (var i = 0; i < clips.length; i++) {
    var clipId = clips[i].external_id;
    if (!clipId || seenIds[clipId]) {
      continue;
    }

    seenIds[clipId] = true;
    var clipName = clips[i].name || "Watch Trailer";
    var thumbnailUrl = "https://img.youtube.com/vi/" + clipId + "/hqdefault.jpg";
    var trailerUrl = clips[i].source_url || ("https://www.youtube.com/watch?v=" + clipId);

    clipHtml += "<li class='video-frame'>" +
      "<a class='trailer-card' href='" + trailerUrl + "' target='_blank' rel='noopener noreferrer'>" +
      "<div class='trailer-media'>" +
      "<img class='trailer-thumbnail' src='" + thumbnailUrl + "' alt='" + clipName.replace(/'/g, "&#39;") + "'>" +
      "<span class='trailer-play'><i class='fa fa-play'></i></span>" +
      "</div>" +
      "<p class='trailer-name'>" + clipName + "</p>" +
      "</a>" +
      "</li>";
    rendered++;

    if (rendered >= 3) {
      break;
    }
  }

  videoContainer.innerHTML = clipHtml;
}

function buildTitleTileHtml(item) {
  var poster = item.poster_url || "";
  var title = item.title || "Untitled";
  var releaseYear = item.release_year || "N/A";
  return "<img class=thumbnail src=" + poster + ">" + "<p>" + title + " <br>" + "(" + releaseYear + ")" + "</p>";
}

function renderSuggestionsList(items) {
  var suggestionsContainer = $("#modal-suggestions");
  var suggestionsSection = $("#suggestions-gallery");

  suggestionsContainer.empty();

  if (!Array.isArray(items) || items.length === 0) {
    suggestionsSection.hide();
    return;
  }

  for (var i = 0; i < items.length; i++) {
    var option = $("<li />");
    option.html(buildTitleTileHtml(items[i]));
    option.attr("data-id", items[i].id);
    option.attr("data-object", items[i].object_type);
    suggestionsContainer.append(option);
  }

  suggestionsSection.show();
}

function fetchAndRenderSuggestions(details, useSeasonLabel) {
  if (!details || !details.title_content || !details.title_content.title) {
    renderSuggestionsList([]);
    return;
  }

  var baseDetails = (useSeasonLabel && currentShowDetails) ? currentShowDetails : details;
  var searchTitle = baseDetails.title_content && baseDetails.title_content.title ? baseDetails.title_content.title : "";
  var currentId = baseDetails.id || details.id;

  if (!searchTitle) {
    renderSuggestionsList([]);
    return;
  }

  var cacheKey = selectedCountry + "::" + searchTitle.toLowerCase();
  if (suggestionCache[cacheKey]) {
    var cachedItems = suggestionCache[cacheKey].filter(function (item) {
      return item.id !== currentId;
    });
    renderSuggestionsList(cachedItems);
    return;
  }

  var client = new HttpClient();
  client.get("https://s.prod.supr.ninja/sw/v2/title?q=" + encodeURIComponent(searchTitle), function (response) {
    var suggestions = JSON.parse(response);
    var filtered = [];

    for (var i = 0; i < suggestions.length; i++) {
      if (suggestions[i].id !== currentId) {
        filtered.push(suggestions[i]);
      }

      if (filtered.length >= 8) {
        break;
      }
    }

    suggestionCache[cacheKey] = filtered;
    renderSuggestionsList(filtered);
  }, selectedCountry, function () {
    renderSuggestionsList([]);
  });
}

function updateCountryAvailability(details) {
  var countryAvailabilityElement = document.querySelector("#country-availability");
  if (!countryAvailabilityElement) {
    return;
  }

  if (details && details.sourceCountry && details.sourceCountry !== "IN" && !details.isUserSelectedCountry) {
    var countryNames = {
      "US": "United States",
      "GB": "United Kingdom",
      "CA": "Canada"
    };
    var countryName = countryNames[details.sourceCountry] || details.sourceCountry;
    countryAvailabilityElement.innerHTML = "📍 This content isn't available in your home country, but is available in " + countryName + ".";
    countryAvailabilityElement.style.display = "block";
  } else {
    countryAvailabilityElement.style.display = "none";
  }
}

function updateModalContent(details, useSeasonLabel) {
  if (!details) {
    return;
  }

  var modalTitle = details.title_content && details.title_content.title ? details.title_content.title : "";
  if (useSeasonLabel && currentShowDetails && currentShowDetails.title_content) {
    modalTitle = currentShowDetails.title_content.title + " - " + modalTitle;
  }

  document.querySelector(".modal-title").innerHTML = modalTitle;

  var descriptionHtml = details.summary || "";
  document.querySelector(".description").innerHTML = descriptionHtml;

  document.querySelector(".imdb").innerHTML = "IMDb" + "<br>" + "<span class= score-details>" + details.scores.imdbScore + "</span>";
  document.querySelector(".rt").innerHTML = "TMDb" + "<br>" + "<span class= score-details>" + details.scores.tmdbScore + "</span>";

  renderTrailers(details.clips);
  fetchAndRenderSuggestions(details, useSeasonLabel);
  updateCountryAvailability(details);

  providers = details.providers || {};
  buildSwitch(providers);
  document.querySelector("#provider-list").innerHTML = "";
  animateContentUpdate();
}

function fetchSeasonDetails(seasonId, previousSeasonId) {
  if (!seasonId) {
    return;
  }

  setModalLoadingState(true);

  if (isUserSelectedCountry) {
    fetchSeasonDetailsForCountry(seasonId, selectedCountry, previousSeasonId);
  } else {
    fetchSeasonDetailsWithFallback(seasonId, ["IN", "US", "GB", "CA"], 0, previousSeasonId);
  }
}

function fetchSeasonDetailsForCountry(seasonId, country, previousSeasonId) {
  var client = new HttpClient();
  client.get("https://s.prod.supr.ninja/sw/v2/title/" + seasonId + "/detail", function (response) {
    var responseData = JSON.parse(response);
    responseData.sourceCountry = country;
    responseData.isUserSelectedCountry = true;

    activeSeasonId = seasonId;
    updateModalContent(responseData, true);
    setActiveSeasonChip(seasonId);
    endSeasonLoadingWithDelay();
  }, country, function () {
    document.querySelector(".headline").innerHTML = "Unable to load season details";
    activeSeasonId = previousSeasonId || null;
    setActiveSeasonChip(activeSeasonId);
    setModalLoadingState(false);
  });
}

function fetchSeasonDetailsWithFallback(seasonId, countries, countryIndex, previousSeasonId) {
  if (countryIndex >= countries.length) {
    document.querySelector(".headline").innerHTML = "Unable to load season details";
    activeSeasonId = previousSeasonId || null;
    setActiveSeasonChip(activeSeasonId);
    setModalLoadingState(false);
    return;
  }

  var client = new HttpClient();
  var currentCountry = countries[countryIndex];

  client.get("https://s.prod.supr.ninja/sw/v2/title/" + seasonId + "/detail", function (response) {
    var responseData = JSON.parse(response);

    if (hasValidProviders(responseData.providers)) {
      responseData.sourceCountry = currentCountry;
      activeSeasonId = seasonId;
      updateModalContent(responseData, true);
      setActiveSeasonChip(seasonId);
      endSeasonLoadingWithDelay();
    } else {
      fetchSeasonDetailsWithFallback(seasonId, countries, countryIndex + 1, previousSeasonId);
    }
  }, currentCountry, function () {
    fetchSeasonDetailsWithFallback(seasonId, countries, countryIndex + 1, previousSeasonId);
  });
}

function showModal(details) {
  document.querySelector("#provider-list").innerHTML = "";
  var container = document.querySelector("#provider-list");
  container.classList.add('pre-animation');

  modal.style.display = "block";
  currentShowDetails = details.object_type === "SHOW" ? details : null;
  activeSeasonId = null;
  updateModalContent(details, false);
  renderSeasonBrowser(currentShowDetails);
  
  // Update page title if not already set by URL routing
  if (!document.title.includes(details.title_content.title)) {
    document.title = details.title_content.title + " - Where Can I Watch This?";
  }

}

function buildSwitch(providers) {

  var packageType = ""

  uniquePackages = getUniquePackages(providers);

  var providerKeys = Object.keys(uniquePackages)
  for (var i = 0; i < providerKeys.length; i++) {
    var packageTypeName = providerKeys[i];
    var providertype = [];
    providertype = providers[packageTypeName];

    if (providertype.length > 0) {
      if (packageTypeName == "flatrate") {
        packageType += "<input id=" + "\"" + packageTypeName + "\"" + " " + "name=\"state-d\"" + " " + "type" + "=\"radio\"" + " " + "onclick" + "=\"filterProvider(this.id)\"> <label for=" + "\"" + packageTypeName + "\">" + "Stream" + "</label>"
      } else {
        packageType += "<input id=" + "\"" + packageTypeName + "\"" + " " + "name=\"state-d\"" + " " + "type" + "=\"radio\"" + " " + "onclick" + "=\"filterProvider(this.id)\"> <label for=" + "\"" + packageTypeName + "\">" + packageTypeName + "</label>"
      }
    }
  }
  document.querySelector(".switch-toggle").innerHTML = packageType;
}

function filterProvider(packageType) {

  var providertype = [];
  providertype = uniquePackages[packageType];

  var images = "";
  var link = "";
  var icon = "";


  for (var i = 0; i < providertype.length; i++) {

    link = providertype[i].redirect_link
    icon = providertype[i].package_icon
    images += "<li class=provider-icon> <a href=" + link + "> <img class=\"channel-img\" src=" + icon + "></li></a>";
  }

  document.querySelector("#provider-list").innerHTML = images;
  setTimeout(function () {
    document.querySelector("#provider-list").classList.remove('pre-animation');
  }, 100)

}

function PopulateDropDownList(data) {
  var ddlCustomers = $("#dataList");
  ddlCustomers.empty();
  $(data).each(function () {
    var option = $("<li />");
    option.html(buildTitleTileHtml(this));
    option.attr('data-id', this.id);
    option.attr('data-object', this.object_type);
    ddlCustomers.append(option);
  });
}

$(document).ready(function () {
  $('input').on('keypress', function (e) {
    if (e.which === 13) {
      fetchMatchingCases();
    }
  });

  $('input').focusout(function (e) {
    fetchMatchingCases();
  });

  function fetchMatchingCases() {
    var txt = $('input[name="search"]').val();
    var client = new HttpClient();
    client.get("https://s.prod.supr.ninja/sw/v2/title?q=" + txt, function (response) {
      var jsonObj = JSON.parse(response);
      PopulateDropDownList(jsonObj);
    }, selectedCountry); // Use selected country for search
  }
});

function getUniquePackages(providers) {
  const uniquePackages = {};

  for (let key in providers) {
    const seenPackageNames = new Set();
    uniquePackages[key] = providers[key].filter(pkg => {
      if (!seenPackageNames.has(pkg.package_name)) {
        seenPackageNames.add(pkg.package_name);
        return true;
      }
      return false;
    });
  }

  return uniquePackages;
}

// URL routing functions for shareable links
function updateURL(movieId, movieTitle) {
  var cleanTitle = movieTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-').toLowerCase();
  var newURL = '#movie/' + movieId + '/' + cleanTitle;
  
  // Update URL without reloading page
  history.pushState({ movieId: movieId, title: movieTitle }, movieTitle + ' - Where Can I Watch This?', newURL);
  
  // Update page title
  document.title = movieTitle + ' - Where Can I Watch This?';
}

function handleURLRouting() {
  var hash = window.location.hash;
  
  if (hash.startsWith('#movie/')) {
    var parts = hash.split('/');
    var movieId = parts[1];
    
    if (movieId && movieId.trim() !== '') {
      // Ensure modal element exists before proceeding
      if (typeof modal === 'undefined' || !modal) {
        // Retry after a short delay if modal not ready
        setTimeout(handleURLRouting, 200);
        return;
      }
      
      // Load movie details from URL
      fetchMovieDetails(movieId);
    } else {
      // Invalid movie ID, go to homepage
      closeModalAndResetURL();
    }
  } else {
    // No hash or invalid hash - close modal and reset title
    if (typeof modal !== 'undefined' && modal) {
      modal.style.display = "none";
    }
    document.title = "Where Can I Watch This?";
    document.querySelector(".headline").innerHTML = "Where can I watch this";
  }
}

function closeModalAndResetURL() {
  if (typeof modal !== 'undefined' && modal) {
    modal.style.display = "none";
  }
  
  // Reset URL to homepage without hash
  history.pushState({}, "Where Can I Watch This?", window.location.pathname);
  document.title = "Where Can I Watch This?";
  document.querySelector(".headline").innerHTML = "Where can I watch this";
}
