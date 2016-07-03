(function() {
  'use strict';
  /*
  THR0W JAVASCRIPT API EXPOSED AS GLOBAL VARIABLE
  ON THE WINDOW OBJECT. REDEFINING LOCALLY TO BE
  EXPLICIT.
  */
  var thr0w = window.thr0w;
  document.addEventListener('DOMContentLoaded', ready);
  function ready() {
    var frameEl = document.getElementById('my_frame');
    /*
    SETS THE THR0W SERVER URL BASE;
    CONFIGURED FOR LOCAL DEVELOPMENT; CHANGE HOSTNAME AS REQUIRED
    */
    thr0w.setBase('http://localhost');
    // ADDS THE LOGIN AND CONNECT FORM TO THE FRAME ELEMENT
    thr0w.addAdminTools(frameEl,
      connectCallback, messageCallback);
    // FUNCTION TO EXECUTE ONCE CLIENT CONNECTS
    function connectCallback() {
      /*
      CREATES A GRID OBJECT THAT PERFORMS THE SHIFTING ON THE CONTENT
      ELEMENT IN THE FRAME DEPENDING ON WHICH CHANNEL THE CLIENT
      CONNECTS TO, E.G., CONNECTING TO CHANNEL 2 WILL SHOW THE
      RIGHT-MOST PORTION OF THE CONTENT.
      */
      new thr0w.Grid(
        frameEl,
        document.getElementById('my_content'), [
          [0, 1, 2]
        ]);
    }
    /*
    FUNCTION TO EXECUTE EACH TIME CLIENT RECEIVES A MESSAGE,
    UNUSED IN THIS SIMPLE EXAMPLE.
    */
    function messageCallback() {}
  }
})();
