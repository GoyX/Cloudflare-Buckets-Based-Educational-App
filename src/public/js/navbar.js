let linksStatus = false;

function showLinks() {
  if (linksStatus == false) {
    let links = document.querySelector(".linksMenu");
    links.style.transform = "translate(0,82%)";
    linksStatus = true;
  } else if (linksStatus == true) {
    let links = document.querySelector(".linksMenu");
    links.style.transform = "translate(0,-200%)";
    linksStatus = false;
  }
}
