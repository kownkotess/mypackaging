import React, { useState, useEffect } from 'react';
import logo from '../assets/logo.png';
import '../styles/ReturnToTop.css';

const ReturnToTop = ({ threshold = 300 }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > threshold) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);

    return () => {
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, [threshold]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <>
      {isVisible && (
        <button 
          className="return-to-top-btn" 
          onClick={scrollToTop}
          title="Return to top"
        >
          <img src={logo} alt="Return to top" className="return-to-top-logo" />
        </button>
      )}
    </>
  );
};

export default ReturnToTop;