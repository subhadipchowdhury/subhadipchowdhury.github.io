/*Toggles the navigation menu for small devices*/

$(document).ready(function () {
    $("#nav-trigger span").click(function () {
      if ($("nav#nav-mobile ul").hasClass("expanded")) {
          $("nav#nav-mobile ul.expanded").removeClass("expanded").slideUp(250);
          $(".wrapper-menu").removeClass("open");
      } 
      else {
        $("nav#nav-mobile ul").addClass("expanded").slideDown(250);
        $(".wrapper-menu").addClass("open");
      }
    });
});

