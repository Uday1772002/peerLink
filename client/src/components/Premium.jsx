import React, { useEffect, useState } from "react";
import axios from "axios";
import { BASE_URL } from "../utils/constants";
import { useDispatch } from "react-redux";
import { addUser } from "../utils/userSlice";
import { useNavigate } from "react-router-dom";

const Premium = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState("");
  const [error, setError] = useState("");
  const [pendingPayment, setPendingPayment] = useState(null);

  useEffect(() => {
    const verifyPremiumUser = async () => {
      try {
        const res = await axios.get(BASE_URL + "/payment/verify", { withCredentials: true });
        dispatch(addUser(res.data.user));
        if (res.data.isPremium) navigate("/premium/success", { replace: true });
      } catch (err) {
        setError(err.response?.data?.message || "Unable to check your membership. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    verifyPremiumUser();
  }, [dispatch, navigate]);

  const verifyPayment = async (payment) => {
    setBuying("verifying");
    setPendingPayment(payment);
    try {
      const res = await axios.post(BASE_URL + "/payment/verify", payment, { withCredentials: true });
      if (!res.data.isPremium) {
        setError(res.data.message || "Your payment is processing. Check again shortly.");
        return;
      }
      dispatch(addUser(res.data.user));
      setPendingPayment(null);
      navigate("/premium/success", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to verify your payment. Please check again.");
    } finally {
      setBuying("");
    }
  };

  const handleBuyClick = async (type) => {
    if (buying || pendingPayment) return;
    setBuying(type);
    setError("");
    try {
      if (!window.Razorpay) throw new Error("Checkout could not load. Please refresh and try again.");
      const order = await axios.post(BASE_URL + "/payment/create", { membershipType: type }, { withCredentials: true });
      const { amount, currency, keyId, notes, orderId } = order.data;
      const rzp = new window.Razorpay({
        key: keyId,
        amount,
        currency,
        name: "devTinder",
        description: type + " Membership",
        order_id: orderId,
        prefill: { name: notes.firstName + " " + (notes.lastName || ""), email: notes.email },
        theme: { color: "#F37254" },
        handler: verifyPayment,
        modal: { ondismiss: () => setBuying("") },
      });
      rzp.on("payment.failed", (response) => {
        setError(response.error?.description || "Payment failed. Please try again.");
        setBuying("");
      });
      rzp.open();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setBuying("");
    }
  };

  const plans = [
    { type: "silver", name: "Silver", icon: "🥈", price: "499", duration: "1 month" },
    { type: "gold", name: "Gold", icon: "🥇", price: "999", duration: "3 months" },
    { type: "platinum", name: "Platinum", icon: "💎", price: "1,999", duration: "12 months" },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center px-4 py-16 pb-28">
      <p className="text-xs font-medium tracking-widest uppercase text-base-content/40 mb-4">
        Choose your plan
      </p>
      <p className="text-sm text-base-content/60 mb-8">
        Free accounts get 10 messages and 10 swipes per day. Every paid plan
        unlocks unlimited access.
      </p>
      {error && (
        <div className="alert alert-error max-w-5xl mb-6" role="alert">
          {error}
        </div>
      )}
      {pendingPayment && (
        <button
          className="btn btn-primary mb-6"
          disabled={Boolean(buying)}
          onClick={() => verifyPayment(pendingPayment)}
        >
          Check payment status
        </button>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-5xl">
        {plans.map((plan) => (
          <div
            key={plan.type}
            className={
              "flex flex-col gap-5 rounded-2xl p-6 bg-base-100 relative " +
              (plan.type === "gold" ? "border-2 border-info" : "border border-base-content/10")
            }
          >
            {plan.type === "gold" && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-4 py-1 rounded-full bg-info text-info-content whitespace-nowrap">
                ⚡ Most popular
              </span>
            )}
            <div className="mt-3">
              <div className="text-2xl mb-2">{plan.icon}</div>
              <h3 className="text-lg font-semibold">{plan.name}</h3>
            </div>
            <div>
              <span className="text-4xl font-semibold">₹{plan.price}</span>
              <span className="text-sm text-base-content/40"> / {plan.duration}</span>
            </div>
            <p className="text-xs text-base-content/50">
              One-time payment. No automatic renewal.
            </p>
            <hr className="border-base-content/10" />
            <ul className="flex flex-col gap-2.5 flex-1 text-sm text-base-content/60">
              <li>✓ Unlimited messages with your connections</li>
              <li>✓ Unlimited swipes</li>
              <li>✓ {plan.name} membership badge</li>
              <li>✓ Access for {plan.duration}</li>
            </ul>
            <button
              onClick={() => handleBuyClick(plan.type)}
              disabled={Boolean(buying) || Boolean(pendingPayment)}
              className={"btn w-full " + (plan.type === "gold" ? "btn-info" : "btn-outline")}
            >
              {buying === plan.type || buying === "verifying" ? "Processing..." : "Select " + plan.name}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Premium;
