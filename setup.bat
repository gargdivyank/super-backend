@echo off
echo Setting up Admin Panel Backend...
echo.
echo This will create the initial super admin user and sample data.
echo Make sure MongoDB is running!
echo.
echo Running setup script...
node scripts/setup.js
echo.
echo Setup completed! You can now start the server with start.bat
pause 