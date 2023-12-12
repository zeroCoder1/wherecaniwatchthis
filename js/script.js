var providers = "";
var offerObject = "";
var objMatches = "";
var mergedObj = "";

$(document).ready(function () {
  $("#dataList").on("click", "li", function () {

    var object = $(this).attr("data-object");
    var id = $(this).attr("data-id");
    var type = $(this).attr("data-object")

    fetchMovieDetails(id);
  });

});

var HttpClient = function () {
  this.get = function (aUrl, aCallback) {
    var anHttpRequest = new XMLHttpRequest();
    anHttpRequest.onreadystatechange = function () {
      if (anHttpRequest.readyState == 4 && anHttpRequest.status == 200) {
        aCallback(anHttpRequest.responseText);
      } else {
        console.log("Not Found");
      }
    }

    anHttpRequest.open("GET", aUrl, true);
    anHttpRequest.setRequestHeader("X-language", "en");
    anHttpRequest.setRequestHeader("X-country", "IN");
    anHttpRequest.send(null);
  }
}

function fetchMovieDetails(id) {
  var jsonObj = ""
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
  for (var i = 0; i < 3; i++) {
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
  buildSwitch();
}

function buildSwitch() {

  var buy = ""
  var rent = ""
  var free = ""
  var stream = ""
  var ads = ""

  stream = "<input id=" + "\"" + "flatrate" + "\"" + " " + "name=\"state-d\"" + " " + "type" + "=\"radio\"" + " " + "onclick" + "=\"filterProvider(this.id)\"> <label for=" + "\"" + "flatrate" + "\">" + "stream" + "</label>"
  free = "<input id=" + "\"" + "free" + "\"" + " " + "name=\"state-d\"" + " " + "type" + "=\"radio\"" + " " + "onclick" + "=\"filterProvider(this.id)\"> <label for=" + "\"" + "free" + "\">" + "free" + "</label>"
  buy = "<input id=" + "\"" + "buy" + "\"" + " " + "name=\"state-d\"" + " " + "type" + "=\"radio\"" + " " + "onclick" + "=\"filterProvider(this.id)\"> <label for=" + "\"" + "buy" + "\">" + "buy" + "</label>"
  rent = "<input id=" + "\"" + "rent" + "\"" + " " + "name=\"state-d\"" + " " + "type" + "=\"radio\"" + " " + "onclick" + "=\"filterProvider(this.id)\"> <label for=" + "\"" + "rent" + "\">" + "rent" + "</label>"
  ads = "<input id=" + "\"" + "ads" + "\"" + " " + "name=\"state-d\"" + " " + "type" + "=\"radio\"" + " " + "onclick" + "=\"filterProvider(this.id)\"> <label for=" + "\"" + "ads" + "\">" + "ads" + "</label>"

  document.querySelector(".switch-toggle").innerHTML = free + ads + stream + buy + rent;
}

function filterProvider(key) {

  console.log(providers[key]);
  
  //   var images = "";
  //   for (var i = 0; i < mergedObj.length; i++) {
  //     var offerObj = mergedObj[i];
  //     if (offerObj.monetization_type === type) {
  //       if (offerObj.iconURL !== 'undefined') {
  //         images += "<li class=provider-icon> <a href=" + offerObj.urls.standard_web + "> <img class=\"channel-img\" src=" + offerObj.iconURL + "></li> </a>";
  //       } else {
  //         images = "";
  //       }
  //     } else {
  //       document.querySelector("#provider-list").innerHTML = "";
  //     }
  //   }
  //   document.querySelector("#provider-list").innerHTML = images;

  //   setTimeout(function(){
  //     document.querySelector("#provider-list").classList.remove('pre-animation');
  // },100)
}

function findObjectByKey(array, key, value) {
  for (var i = 0; i < array.length; i++) {
    if (array[i][key] === value) {
      return array[i];
    }
  }
  return null;
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


