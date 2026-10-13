import DeveloperDetails from "./DeveloperDetails";
import MembershipBadge from "./MembershipBadge";
import React, { useEffect, useState } from "react";
import axios from "axios";
import { BASE_URL } from "../utils/constants";

const Requests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const fetchRequests = async () => {
    try {
      const res = await axios.get(BASE_URL + "/user/requests/received", {
        withCredentials: true,
      });
      setRequests(res.data.data);
    } catch {
      setError("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (status, requestId) => {
    setActionLoading(requestId);
    try {
      await axios.post(
        `${BASE_URL}/request/review/${status}/${requestId}`,
        {},
        { withCredentials: true },
      );
      setRequests((prev) => prev.filter((r) => r._id !== requestId));
    } catch {
      setError("Action failed. Please try again.");
      setTimeout(() => setError(""), 3000);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-1">Connection Requests</h1>
        <p className="text-base-content/50 text-sm mb-8">
          {requests.length} pending{" "}
          {requests.length === 1 ? "request" : "requests"}
        </p>

        {error && (
          <div className="alert alert-error mb-6">
            <span>{error}</span>
          </div>
        )}

        {requests.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-base-content/40">
            <span className="text-6xl">📭</span>
            <p className="text-lg font-medium">No pending requests</p>
            <p className="text-sm">
              When someone is interested in you, they'll show up here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {requests.map((req) => {
              const user = req.fromUserId;
              return (
                <div
                  key={req._id}
                  className="card card-side bg-base-300 shadow-lg hover:shadow-xl transition-shadow duration-200"
                >
                  <figure className="w-28 shrink-0">
                    <img
                      src={
                        user.photoUrl ||
                        "https://api.dicebear.com/9.x/thumbs/svg?seed=" +
                          user._id
                      }
                      alt={user.firstName}
                      className="w-28 h-full object-cover"
                      onError={(e) => {
                        e.target.src =
                          "https://api.dicebear.com/9.x/thumbs/svg?seed=" +
                          user._id;
                      }}
                    />
                  </figure>
                  <div className="card-body py-4 px-5 gap-1">
                    <h2 className="card-title text-base font-bold">
                      {user.firstName} {user.lastName}
                      {user.age && (
                        <span className="text-sm font-normal text-base-content/50">
                          , {user.age}
                        </span>
                      )}
                    </h2>
                    <MembershipBadge user={user} />
                    <DeveloperDetails user={user} />
                    {user.gender && (
                      <p className="text-xs text-base-content/50 capitalize">
                        {user.gender}
                      </p>
                    )}
                    {user.about && (
                      <p className="text-sm text-base-content/70 line-clamp-2 mt-1">
                        {user.about}
                      </p>
                    )}
                    {user.skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {user.skills.slice(0, 4).map((skill, i) => (
                          <span
                            key={i}
                            className="badge badge-outline badge-xs"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-3 mt-3">
                      <button
                        className="btn btn-success btn-sm flex-1"
                        disabled={actionLoading === req._id}
                        onClick={() => handleReview("accepted", req._id)}
                      >
                        {actionLoading === req._id ? (
                          <span className="loading loading-spinner loading-xs"></span>
                        ) : (
                          "Accept"
                        )}
                      </button>
                      <button
                        className="btn btn-error btn-outline btn-sm flex-1"
                        disabled={actionLoading === req._id}
                        onClick={() => handleReview("rejected", req._id)}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Requests;
