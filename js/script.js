var jsonObj = ""
var providers = "";
var uniquePackages;

$(document).ready(function () {
  $("#dataList").on("click", "li", function () {
    var id = $(this).attr("data-id");
    fetchMovieDetails(id);
  });

});

var HttpClient = function () {
  this.get = function (aUrl, aCallback) {
    var anHttpRequest = new XMLHttpRequest();
    anHttpRequest.onreadystatechange = function () {
      if (anHttpRequest.readyState == 4 && anHttpRequest.status == 200) {
        document.querySelector(".headline").innerHTML = "Where can I watch this";
        aCallback(anHttpRequest.responseText);
      } else if (anHttpRequest.status == 404) {
        document.querySelector(".headline").innerHTML = "AW SNAP!!";
        var ddlCustomers = $("#dataList");
        ddlCustomers.empty();
      } else {
        document.querySelector(".headline").innerHTML = "Let's do this";
      }
    }

    anHttpRequest.open("GET", aUrl, true);
    anHttpRequest.setRequestHeader("X-language", "en");
    anHttpRequest.setRequestHeader("X-country", "IN");
    anHttpRequest.send(null);
  }
}

function fetchMovieDetails(id) {
  jsonObj = ""
  var client = new HttpClient();
  client.get("https://s.prod.supr.ninja/sw/v2/title/" + id + "/detail", function (response) {
    jsonObj = JSON.parse(response);
    showModal(jsonObj);
  });
}

function showModal(details) {
  document.querySelector("#provider-list").innerHTML = "";
  var container = document.querySelector("#provider-list");
  container.classList.add('pre-animation');

  modal.style.display = "block";
  document.querySelector(".modal-title").innerHTML = details.title_content.title;
  document.querySelector(".description").innerHTML = details.summary;
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
    });
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
