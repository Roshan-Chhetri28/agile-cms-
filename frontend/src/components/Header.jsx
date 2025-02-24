import React from "react";
import logo from "../assets/bbLogo.png";

const Header = () => {
  return (
    <header className="flex items-center justify-between p-4 shadow-md border-b w-screen">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <img src={logo} alt="Logo" className="h-10" />
        <h1 className="text-lg font-semibold text-white">Admin Panel</h1>
      </div>
      
    </header>
  );
};

export default Header;
