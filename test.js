var jsmediatags = require("jsmediatags");
jsmediatags.read("https://www.sebastianlasse.de/mov.mkv", {
  onSuccess: function(tag) {
    console.log(tag);
  },
  onError: function(error) {
    console.log(':(', error.type, error.info);
  }
});
