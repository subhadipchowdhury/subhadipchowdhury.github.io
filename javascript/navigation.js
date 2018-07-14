/*Toggles the navigation menu for small devices*/

$(document).ready(function () {
    $("#nav-mobile").html($("#nav-main").html());
    $("#nav-trigger span").click(function () {
      if ($("nav#nav-mobile ul").hasClass("expanded")) {
          $("nav#nav-mobile ul.expanded").removeClass("expanded").slideUp(250);
          $(".wrapper-menu").removeClass("open");
          $("nav#nav-mobile").css("display","none");
      } 
      else {
        $("nav#nav-mobile ul").addClass("expanded").slideDown(250);
        $("nav#nav-mobile").css("display","block");
        $(".wrapper-menu").addClass("open");
      }
    });
});

