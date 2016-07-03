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
    function connectCallback() {
      var far = 0;
      var near = 0;
      var hill1El = document.getElementById('hill1');
      var hill2El = document.getElementById('hill2');
      var hill3El = document.getElementById('hill3');
      var hill4El = document.getElementById('hill4');
      var grid = new thr0w.Grid(
        frameEl,
        document.getElementById('my_content'), [
          [0, 1, 2]
        ]);
      var width = grid.getWidth(); // GET WIDTH OF CONTENT ELEMENT
      //USED TO SYNCHRONIZE THE SCREENS IN A GRID
      var sync = new thr0w.Sync(
        grid,
        'animation', // UNIQUE IDENTIFIER FOR SYNC
        message, // SEE FUNCTION BELOW
        receive // SEE FUNCTION BELOW
      );
      // LEFT-MOST SCREEN (CHANNEL 0) PERFORMS ANIMATION LOOP
      if (thr0w.getChannel() === 0) {
        window.setInterval(loop, 33);
      }
      /*
      FUNCTION THAT RETURNS THE CONTENT OF AN UPDATE MESSAGE, E.G.,
      THE POSITION OF THE FAR AND NEAR HILLS.
      */
      function message() {
        return {
          far: far,
          near: near
        };
      }
      /*
      FUNCTION THAT UPDATES THE SCREEN FROM AN UPDATE MESSAGE; E.G.,
      POSITION THE FAR AND NEAR HILLS.
      */
      function receive(data) {
        hill1El.style.marginLeft = data.far + 'px';
        hill2El.style.marginLeft = data.far + 'px';
        hill3El.style.marginLeft = data.near + 'px';
        hill4El.style.marginLeft = data.near + 'px';
      }
      // THE ANIMATION LOOP
      function loop() {
        // SHIFT HILLS TO THE RIGHT
        far = far < width - 2 ? far + 3 : 0;
        near = near < width - 4 ? near + 5 : 0;
        hill1El.style.marginLeft = far + 'px';
        hill2El.style.marginLeft = far + 'px';
        hill3El.style.marginLeft = near + 'px';
        hill4El.style.marginLeft = near + 'px';
        sync.update(); // CAUSES THE SYNC OBJECT TO SEND UPDATE MESSAGE.
      }
    }
  }
  function messageCallback() {}
})();
