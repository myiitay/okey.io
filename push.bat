@echo off
echo 🚀 GitHub Guncelleme Baslatiliyor...
set /p msg="Commit mesaji girin (Varsayilan: update): "
if "%msg%"=="" set msg=update

git add .
git commit -m "%msg%"
git push

echo.
echo ✅ Islem tamamlandi!
pause
