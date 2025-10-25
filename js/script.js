var jsonObj = ""
var providers = "";
var uniquePackages;

$(document).ready(function () {
  $("#dataList").on("click", "li", function () {
    var id = $(this).attr("data-id");
    var title = $(this).find("p").text().split("(")[0].trim(); // Extract title
    
    // Update URL first, then fetch details
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

function fetchMovieDetails(id) {
  jsonObj = ""
  
  // Show loading state
  document.querySelector(".headline").innerHTML = "Loading...";
  
  // Try India first
  fetchMovieDetailsWithFallback(id, ["IN", "US", "GB", "CA"], 0);
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

function showModal(details) {
  document.querySelector("#provider-list").innerHTML = "";
  var container = document.querySelector("#provider-list");
  container.classList.add('pre-animation');

  modal.style.display = "block";
  document.querySelector(".modal-title").innerHTML = details.title_content.title;
  document.querySelector(".description").innerHTML = details.summary;
  
  // Update page title if not already set by URL routing
  if (!document.title.includes(details.title_content.title)) {
    document.title = details.title_content.title + " - Where Can I Watch This?";
  }
  var img = "";
  for (var i = 0; i < details.title_backdrops.length; i++) {
    var imageURL = details.title_backdrops[i];
    img += "<img class=\"backdrop\" src=" + imageURL + ">"
  }

  document.querySelector(".crossfade").innerHTML = "<div class=\"gallery\">" + img + "</div>";
  document.querySelector(".imdb").innerHTML = "IMDb" + "<br>" + "<span class= score-details>" + details.scores.imdbScore + "</span>";
  document.querySelector(".rt").innerHTML = "TMDb" + "<br>" + "<span class= score-details>" + details.scores.tmdbScore + "</span>";


  // if (details.clips) {
  //   var clip = "";
  //   //for (var i = 0; i < details.clips.length; i++) {
  //     var youtuber = details.clips[0];
  //     clip = "<li class=video-frame><iframe src=https://www.youtube.com/embed/" + youtuber.external_id + " allowfullscreen></iframe></li>";
  //  // }
  //   document.querySelector("#video").innerHTML = clip;

  // } else {
  //   document.querySelector("#video").innerHTML = "";
  // }

  // Show country availability message if content is from a different country
  var countryAvailabilityElement = document.querySelector("#country-availability");
  
  if (countryAvailabilityElement && details.sourceCountry && details.sourceCountry !== "IN") {
    var countryNames = {
      "US": "United States",
      "GB": "United Kingdom", 
      "CA": "Canada"
    };
    var countryName = countryNames[details.sourceCountry] || details.sourceCountry;
    countryAvailabilityElement.innerHTML = "📍 This content isn't available in your home country, but is available in " + countryName + ".";
    countryAvailabilityElement.style.display = "block";
  } else {
    if (countryAvailabilityElement) {
      countryAvailabilityElement.style.display = "none";
    }
  }

  providers = details.providers;
  buildSwitch(providers);
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
    var poster = this.poster_url;
    option.html("<img class=thumbnail src=" + poster + ">" + "<p>" + this.title + " <br>" + "(" + this.release_year + ")" + "</p>");
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
    }, "IN"); // Always search with India for search results
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
