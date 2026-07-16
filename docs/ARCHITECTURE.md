# Kien truc du an

## Tong quan

Du an duoc chia thanh 4 khu vuc chinh:

- frontend: giao dien HTML, CSS, Vanilla JavaScript.
- backend: Node.js, Express.js theo MVC.
- database: tai lieu va script MySQL sau khi duoc xac nhan.
- docs: tai lieu thiet ke, kien truc va quy uoc phat trien.

## Kien truc de xuat

Backend nen di theo luong:

Route -> Controller -> Service -> Model -> Database

- Route: khai bao endpoint va gan controller.
- Controller: nhan request, validate co ban, tra response.
- Service: xu ly nghiep vu va dieu phoi model.
- Model: truy cap du lieu MySQL.
- Middleware: auth, error handler, upload, logging.
- Utils: helper dung chung, khong chua nghiep vu chinh.

Frontend Admin nen di theo luong:

Admin Layout -> Shared Components -> Page Module

- Admin Layout: khung tong gom Sidebar, Header, Content, Footer.
- Components: thanh phan dung lai, khong copy giua cac trang.
- Page Module: moi trang co HTML, CSS, JS rieng.
- Assets: CSS/JS/images/icons dung chung.

## Nguyen tac mo rong

- Moi module nghiep vu co route, controller, service va model rieng.
- Khong viet tat ca vao mot file.
- CSS dung chung dat trong frontend/assets/css, CSS rieng dat theo tung component/page.
- JavaScript dung chung dat trong frontend/assets/js, JS rieng dat theo tung component/page.
- Admin Panel dung chung Sidebar, Header va Footer cho tat ca trang.
