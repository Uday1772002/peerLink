import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { BASE_URL } from "../utils/constants";
import { addUser } from "../utils/userSlice";
import MembershipBadge from "./MembershipBadge";

const PremiumSuccess = () => {
  const user = useSelector((store) => store.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const verifyPremiumUser = async () => {
      try {
        const res = await axios.get(BASE_URL + "/payment/verify", { withCredentials: true });
        dispatch(addUser(res.data.user));
        if (!res.data.isPremium) navigate("/premium", { replace: true });
      } catch {
        setError("Unable to load your membership. Please refresh to try again.");
      } finally {
        setLoading(false);
      }
    };
    verifyPremiumUser();
  }, [dispatch, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center px-4 py-16 pb-28">
      <div className="card bg-base-100 shadow-xl w-full max-w-lg">
        <div className="card-body items-center text-center gap-5">
          {error ? (
            <p className="text-error" role="alert">{error}</p>
          ) : (
            <>
              <span className="text-5xl">🎉</span>
              <h1 className="card-title text-2xl">You are a premium user!</h1>
              <MembershipBadge user={user} />
              <p>Welcome, {user?.firstName}. Your membership is active.</p>
              <p className="text-sm text-base-content/60">
                Valid until {new Date(user?.membershipValidUntil).toLocaleDateString()}
              </p>
              <ul className="text-sm space-y-2">
                <li>✓ Unlimited messages with your connections</li>
                <li>✓ Unlimited swipes</li>
                <li>✓ Your membership badge is visible on your profile</li>
              </ul>
              <div className="card-actions mt-3">
                <Link to="/" className="btn btn-primary">Start swiping</Link>
                <Link to="/connections" className="btn btn-outline">Chat with connections</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PremiumSuccess;
