import React from "react";
import Navbar from "./NavBar";
import { Outlet, useLocation } from "react-router-dom";
import Footer from "./Footer";
import axios from "axios";
import { BASE_URL } from "../utils/constants";
import { useDispatch } from "react-redux";
import { addUser } from "../utils/userSlice";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

const Body = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const userData = useSelector((store) => store.user);
  const location = useLocation();
  useEffect(() => {
    const fetchUser = async () => {
      try {
        if (userData || ["/login", "/signup"].includes(location.pathname)) return; // Skip fetch if user data already exists
        const res = await axios.get(BASE_URL + "/profile/view", {
          withCredentials: true,
        });
        dispatch(addUser(res.data));
      } catch (err) {
        if (err.response?.status === 401) {
          navigate("/login");
        }

        console.error("Failed to fetch user data", err);
      }
    };
    fetchUser();
  }, [userData, dispatch, navigate, location.pathname]);
  return (
    <div>
      <Navbar />
      <Outlet />
      <Footer />
    </div>
  );
};

export default Body;
