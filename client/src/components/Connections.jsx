import MembershipBadge from "./MembershipBadge";
import React, { useEffect, useState } from "react";
import axios from "axios";
import { BASE_URL } from "../utils/constants";
import { Link } from "react-router-dom";

const Connections = () => {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchConnections = async () => {
    try {
      const res = await axios.get(BASE_URL + "/user/connections", {
        withCredentials: true,
      });
      setConnections(res.data.data);
    } catch {
      setError("Failed to load connections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
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
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-1">Connections</h1>
        <p className="text-base-content/50 text-sm mb-8">
          {connections.length}{" "}
          {connections.length === 1 ? "connection" : "connections"}
        </p>

        {error && (
          <div className="alert alert-error mb-6">
            <span>{error}</span>
          </div>
        )}

        {connections.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-base-content/40">
            <span className="text-6xl">🤝</span>
            <p className="text-lg font-medium">No connections yet</p>
            <p className="text-sm">
              Start swiping on the feed to connect with people!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {connections.map((user) => (
              <div
                key={user._id}
                className="card card-side bg-base-300 shadow-lg hover:shadow-xl transition-shadow duration-200"
              >
                <figure className="w-28 shrink-0">
                  <img
                    src={
                      user.photoUrl ||
                      "https://api.dicebear.com/9.x/thumbs/svg?seed=" + user._id
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
                      {user.skills.slice(0, 3).map((skill, i) => (
                        <span key={i} className="badge badge-outline badge-xs">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="card-actions mt-3">
                    <Link to={'/chat/' + user._id}>
                      <button className="btn btn-primary btn-sm gap-2">
                        💬 Chat
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Connections;
