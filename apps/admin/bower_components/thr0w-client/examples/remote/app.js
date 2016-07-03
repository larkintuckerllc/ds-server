(function() {
  'use strict';
  var thr0w = window.thr0w;
  document.addEventListener('DOMContentLoaded', ready);
  function ready() {
    var frameEl = document.getElementById('my_frame');
    // CONFIGURED FOR LOCAL DEVELOPMENT; CHANGE HOSTNAME AS REQUIRED
    thr0w.setBase('http://localhost');
    thr0w.addAdminTools(frameEl,
      connectCallback, messageCallback);
    /*
    FUNCTION TO EXECUTE WHEN CLIENT CONNECTS; IN THIS CASE UNUSED
    */
    function connectCallback() {
    }
    /*
    FUNCTION TO EXECUTE EACH TIME CLIENT RECEIVES A MESSAGE
    */
    function messageCallback(data) {
      frameEl.style.backgroundColor = data.message.color;
    }
  }
})();
