console.clear();

const tableRow = document.querySelectorAll(".list__row");
const overlay = document.querySelector(".overlay");
const sidebar = document.querySelector(".sidebar");
const closeOverlayBtn = document.querySelector(".button--close");

const sidebarClose = () => {
  sidebar.classList.remove("is-open");
  overlay.style.opacity = 0;
  setTimeout(() => {
    overlay.classList.remove("is-open");
    overlay.style.opacity = 1;
  }, 300);
};

tableRow.forEach(tableRow => {
  tableRow.addEventListener("click", function () {
    overlay.style.opacity = 0;
    overlay.classList.add("is-open");
    sidebar.classList.add("is-open");
    setTimeout(() => {
      overlay.style.opacity = 1;
    }, 100);
    // Sidebar header
    const sidebarHeader = document.querySelector(".sidebar__header");
    var btnClode = document.querySelector(".button--close");
    sidebarHeader.innerHTML = '';

    // Sidebar content
    const sidebarBody = document.querySelector(".sidebar__body");
    sidebarBody.innerHTML = '';

    const driverName = this.querySelector(".list__cell:nth-of-type(2) .list__value").innerHTML;
    const items = this.querySelector(".list__cell:nth-of-type(3) .list__value").innerHTML;
    const points = this.querySelector(".list__cell:nth-of-type(4) .list__value").innerHTML;
    const driverImage = this.dataset.image;
    const list_items = JSON.parse(this.dataset.items);
    const newDriver = document.createElement('div');
    newDriver.classList = 'driver';

    const driverContent = document.createElement('div');
    driverContent.classList = 'driver__content';

    const profile = document.createElement('div');
    profile.classList = 'driver__image';
    profile.style.backgroundImage = `url('${driverImage}')`;
    newDriver.appendChild(profile);

    const driverTitle = document.createElement('div');
    driverTitle.classList = 'driver__title';
    driverTitle.innerHTML = driverName;
    driverContent.appendChild(driverTitle);

    const driverInfo = document.createElement('div');
    
    driverInfo.innerHTML = `
		<table class="driver__table">
			<tbody>
				<tr>
					<td><small>Items</small></td>
					<td>${items}</td>
				</tr>
					<td><small>Points</small></td>
					<td>${points}</td>
        </tr></tbody>
    </table>`;;
    driverContent.appendChild(driverInfo);

    newDriver.appendChild(driverContent);
    sidebarHeader.appendChild(newDriver);
    sidebarHeader.appendChild(btnClode);

    const driverItems = document.createElement('div');
    var html = '<div class="items">'
    for (var i=0; i< list_items.length; i++){
      for (var j = 0; j < list_items[i].total; j++) {
        html+= `
        <img src="/logo/${list_items[i].item}.png" title="${list_items[i].item}" alt="${list_items[i].item}">
      `
      }
      
    }
    html += '</div>'
    driverItems.innerHTML = html;
    sidebarBody.appendChild(driverItems);
  });
});
function openCity(cityName) {
  var i;
  var x = document.getElementsByClassName("city");
  for (i = 0; i < x.length; i++) {
    x[i].style.display = "none";
  }
  document.getElementById(cityName).style.display = "block";
}
closeOverlayBtn.addEventListener("click", function () {
  sidebarClose();
});

overlay.addEventListener("click", function () {
  sidebarClose();
});