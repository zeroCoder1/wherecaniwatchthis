var providers = "";
var offerObject = "";
var objMatches = "";

$(document).ready(function () {
  $("#dataList").on("click", "li", function () {

    var object = $(this).attr("data-object");
    var id = $(this).attr("data-id");

    fetchMovieDetails(object + "/" + id);
  });

});

var HttpClient = function () {
  this.get = function (aUrl, aCallback) {
    var anHttpRequest = new XMLHttpRequest();
    anHttpRequest.onreadystatechange = function () {
      if (anHttpRequest.readyState == 4 && anHttpRequest.status == 200)
        aCallback(anHttpRequest.responseText);
    }

    anHttpRequest.open("GET", aUrl, true);
    anHttpRequest.send(null);
  }
}

function fetchProviders() {
  var client = new HttpClient();
  client.get("https://cors-anywhere.herokuapp.com/https://apis.justwatch.com/content/providers/locale/en_IN", function (response) {
    var jsonObj = JSON.parse(response);
    providers = jsonObj;
  });
}

function fetchMovieDetails(id) {
  var client = new HttpClient();
  client.get("https://cors-anywhere.herokuapp.com/https://apis.justwatch.com/content/titles/" + id + "/locale/en_IN", function (response) {
    var jsonObj = JSON.parse(response);
    showModal(jsonObj);
  });
}

function showModal(details) {
  modal.style.display = "block";
  document.querySelector(".modal-title").innerHTML = details.title;
  document.querySelector(".description").innerHTML = details.short_description;
  var img = "";
  for (var i = 0; i < 3; i++) {
    if (details.hasOwnProperty('backdrops')) {
      if (typeof details.backdrops[i] !== "undefined") {
        var imageURL = details.backdrops[i].backdrop_url;
        img += "<img class=\"backdrop\" src=" + "https://images.justwatch.com" + imageURL.replace("{profile}", "s1920>")
      } else {
        img = ""
      }
    } else {
      img = ""
    }
  }

  document.querySelector(".crossfade").innerHTML = "<div class=\"gallery\">" + img + "</div>";

  for (var i = 0; i < details.scoring.length; i++) {
    var detail = details.scoring[i];

    if (detail.provider_type === "imdb:score") {
      document.querySelector(".imdb").innerHTML = "IMDb" + "<br>" + "<span class= score-details>" + detail.value + "</span>";
    }

    if (detail.provider_type === "tomato:meter") {
      document.querySelector(".rt").innerHTML = "Rotten Tomatoes" + "<br>" + "<span class= score-details>" + detail.value + "</span>";
    }

  }

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

  var channels = ""
  var img = ""
  var filterIcon = ""
  if (details.hasOwnProperty('offers')) {
    for (var i = 0; i < details.offers.length; i++) {
      if (typeof details.offers[i] !== "undefined") {
        var offer = details.offers[i];
        objMatches = findObjectByKey(providers, 'id', offer.provider_id);
        if (objMatches !== null) {
          if (objMatches.icon_url !== null) {
            details.offers[i].iconURL = "https://images.justwatch.com" + objMatches.icon_url.replace("{profile}", "s100");

            if (objMatches.clear_name !== "undefined") {
              details.offers[i].clearName = objMatches.clear_name;
            }
            // channels += "<img class=\"channel-img\" src=" + "https://images.justwatch.com" + objMatches.icon_url.replace("{profile}", "s100>")
          }
        }
      }
    }

    offerObject = details.offers;
    buildSwitch(offerObject);
  } else {
    // document.querySelector("#provider-list").innerHTML = "";
  }

}

function buildSwitch(offerObject) {

  var buy = ""
  var rent = ""
  var free = ""
  var stream = ""
  var ads = ""

  for (var i = 0; i < offerObject.length; i++) {
    var offerObj = offerObject[i];

    if (offerObj.monetization_type === "buy") {
      buy = "<input id=" + "\"" + "buy" + "\"" + " " + "name=\"state-d\"" + " " + "type" + "=\"radio\"" + " " + "onclick" + "=\"filterProvider(this.id)\"> <label for=" + "\"" + "buy" + "\">" + "buy" + "</label>"
    }
    if (offerObj.monetization_type === "free") {
      free = "<input id=" + "\"" + "free" + "\"" + " " + "name=\"state-d\"" + " " + "type" + "=\"radio\"" + " " + "onclick" + "=\"filterProvider(this.id)\"> <label for=" + "\"" + "free" + "\">" + "free" + "</label>"
    }
    if (offerObj.monetization_type === "rent") {
      rent = "<input id=" + "\"" + "rent" + "\"" + " " + "name=\"state-d\"" + " " + "type" + "=\"radio\"" + " " + "onclick" + "=\"filterProvider(this.id)\"> <label for=" + "\"" + "rent" + "\">" + "rent" + "</label>"
    }
    if (offerObj.monetization_type === "ads") {
      ads = "<input id=" + "\"" + "ads" + "\"" + " " + "name=\"state-d\"" + " " + "type" + "=\"radio\"" + " " + "onclick" + "=\"filterProvider(this.id)\"> <label for=" + "\"" + "ads" + "\">" + "ads" + "</label>"
    }
    if (offerObj.monetization_type === "flatrate") {
      stream = "<input id=" + "\"" + "flatrate" + "\"" + " " + "name=\"state-d\"" + " " + "type" + "=\"radio\"" + " " + "onclick" + "=\"filterProvider(this.id)\"> <label for=" + "\"" + "flatrate" + "\">" + "stream" + "</label>"
    }

  }
  document.querySelector(".switch-toggle").innerHTML = buy + rent + free + stream + ads;


}

function filterProvider(type) {
  var images = "";
  for (var i = 0; i < offerObject.length; i++) {
    var offerObj = offerObject[i];
    if (offerObj.monetization_type === type) {
      if (offerObj.iconURL !== "undefined") {
        images += "<li class=provider-icon> <img class=\"channel-img\" src=" + offerObj.iconURL + "></li>";
      } else {
        images = "";
      }
    } else {
      document.querySelector("#provider-list").innerHTML = "";
    }
    console.log(offerObj);
  }
  document.querySelector("#provider-list").innerHTML = images;
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
    var poster = this.poster;
    var posterURL = poster.replace("{profile}", "s332>");
    option.html("<img class=thumbnail src=" + "https://images.justwatch.com" + posterURL + "<p>" + this.title + " <br>" + "(" + this.original_release_year + ")" + "</p>");
    option.attr('data-id', this.id);
    option.attr('data-object', this.object_type);
    ddlCustomers.append(option);
  });
}

$(document).ready(function () {
  $("input").keypress(function () {
    var keycode = (event.keyCode ? event.keyCode : event.which);
    var data = [];

    if (keycode == '13') {

      var txt = $('input[name="search"]').val();
      $.ajax({
        url: "https://cors-anywhere.herokuapp.com/https://apis.justwatch.com/content/titles/en_IN/popular",
        type: "POST",
        data: JSON.stringify(
          {
            "page_size": 10,
            "page": 1,
            "query": txt,
            "content_types": ["show", "movie"]
          }
        ),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (result) {
          data = result.items
          PopulateDropDownList(data);
        }
      });
    }
  });
});