import { useCallback, useEffect, useState } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";

function formatMoney(cents, currency = "EGP") {
  const amount = ((Number(cents) || 0) / 100).toFixed(2);
  return `${amount} ${currency}`;
}

function toIsoString(localInput) {
  if (!localInput) return null;
  const dt = new Date(localInput);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

export default function App() {
  const { getToken, isSignedIn } = useAuth();

  const [tab, setTab] = useState("locations"); // "locations" | "equipment" | "freelancers" | "bookings" | "create"
  const [cityFilter, setCityFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null); // { type: "success" | "error", text: string }

  const [locationsList, setLocationsList] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const [freelancersList, setFreelancersList] = useState([]);

  const [myBookings, setMyBookings] = useState({
    locations: [],
    equipment: [],
    freelancers: [],
  });
  const [incomingBookings, setIncomingBookings] = useState({
    locations: [],
    equipment: [],
    freelancers: [],
  });

  // Booking form state
  const [bookingTarget, setBookingTarget] = useState({
    type: "locations", // "locations" | "equipment" | "freelancers"
    id: "",
    label: "",
    startAt: "",
    endAt: "",
    notes: "",
  });

  // Create Location form state
  const [locForm, setLocForm] = useState({
    name: "",
    slug: "",
    description: "",
    city: "",
    address: "",
    category: "studio",
    priceEgp: "500",
    pricingUnit: "hour",
  });

  // Create Equipment form state
  const [eqForm, setEqForm] = useState({
    name: "",
    slug: "",
    description: "",
    category: "camera",
    condition: "excellent",
    priceEgp: "1200",
    depositEgp: "5000",
    pricingUnit: "day",
    city: "",
  });

  // Freelancer profile form state
  const [flForm, setFlForm] = useState({
    specialty: "photographer",
    bio: "",
    city: "",
    priceEgp: "2500",
    pricingUnit: "day",
    isAvailable: true,
  });

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [getToken]);

  const loadListings = useCallback(async () => {
    setLoading(true);
    setBanner(null);
    try {
      const q = cityFilter.trim() ? `?city=${encodeURIComponent(cityFilter.trim())}` : "";
      const [locRes, eqRes, flRes] = await Promise.all([
        fetch(`/api/locations${q}`),
        fetch(`/api/equipment${q}`),
        fetch(`/api/freelancers${q}`),
      ]);

      const [locJson, eqJson, flJson] = await Promise.all([
        locRes.json(),
        eqRes.json(),
        flRes.json(),
      ]);

      setLocationsList(Array.isArray(locJson.data) ? locJson.data : []);
      setEquipmentList(Array.isArray(eqJson.data) ? eqJson.data : []);
      setFreelancersList(Array.isArray(flJson.data) ? flJson.data : []);
    } catch {
      setBanner({ type: "error", text: "تعذر تحميل العناصر من السيرفر." });
    } finally {
      setLoading(false);
    }
  }, [cityFilter]);

  const loadBookings = useCallback(async () => {
    if (!isSignedIn) return;
    setLoading(true);
    try {
      const headers = await authHeaders();
      const [myRes, incRes] = await Promise.all([
        fetch("/api/bookings/my", { headers }),
        fetch("/api/bookings/incoming", { headers }),
      ]);

      if (myRes.ok) {
        const myJson = await myRes.json();
        setMyBookings(
          myJson.data ?? { locations: [], equipment: [], freelancers: [] }
        );
      }
      if (incRes.ok) {
        const incJson = await incRes.json();
        setIncomingBookings(
          incJson.data ?? { locations: [], equipment: [], freelancers: [] }
        );
      }
    } catch {
      setBanner({ type: "error", text: "تعذر تحميل الحجوزات." });
    } finally {
      setLoading(false);
    }
  }, [authHeaders, isSignedIn]);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  useEffect(() => {
    if (isSignedIn && tab === "bookings") {
      void loadBookings();
    }
  }, [isSignedIn, tab, loadBookings]);

  function openBooking(type, item) {
    const label =
      type === "locations"
        ? `${item.name} (${item.city})`
        : type === "equipment"
        ? `${item.name} (${item.city})`
        : `${item.specialty} (${item.city})`;

    setBookingTarget({
      type,
      id: item.id,
      label,
      startAt: "",
      endAt: "",
      notes: "",
    });
    setBanner(null);
  }

  async function handleCreateBooking(e) {
    e.preventDefault();
    if (!isSignedIn) {
      setBanner({ type: "error", text: "سجّل دخولك أولاً لإتمام الحجز." });
      return;
    }

    const startIso = toIsoString(bookingTarget.startAt);
    const endIso = toIsoString(bookingTarget.endAt);
    if (!startIso || !endIso) {
      setBanner({ type: "error", text: "يرجى إدخال وقت بداية ونهاية صحيحين." });
      return;
    }

    const idField =
      bookingTarget.type === "locations"
        ? "locationId"
        : bookingTarget.type === "equipment"
        ? "equipmentId"
        : "freelancerId";

    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/bookings/${bookingTarget.type}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          [idField]: bookingTarget.id,
          startAt: startIso,
          endAt: endIso,
          notes: bookingTarget.notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBanner({
          type: "error",
          text: json.error || "تعذر إنشاء الحجز (قد يكون هناك تعارض في المواعيد).",
        });
        return;
      }

      setBanner({ type: "success", text: "تم إرسال طلب الحجز بنجاح." });
      setBookingTarget((prev) => ({ ...prev, id: "", label: "", startAt: "", endAt: "", notes: "" }));
      setTab("bookings");
      await loadBookings();
    } catch {
      setBanner({ type: "error", text: "حدث خطأ في الشبكة أثناء إنشاء الحجز." });
    }
  }

  async function handleBookingStatus(type, bookingId, status) {
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/bookings/${type}/${bookingId}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBanner({ type: "error", text: json.error || "تعذر تحديث حالة الحجز." });
        return;
      }
      setBanner({ type: "success", text: `تم تحديث حالة الحجز إلى: ${status}` });
      await loadBookings();
    } catch {
      setBanner({ type: "error", text: "حدث خطأ أثناء تحديث حالة الحجز." });
    }
  }

  async function handleCreateLocation(e) {
    e.preventDefault();
    const headers = await authHeaders();
    const res = await fetch("/api/locations", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: locForm.name.trim(),
        slug: locForm.slug.trim(),
        description: locForm.description.trim(),
        city: locForm.city.trim(),
        address: locForm.address.trim(),
        category: locForm.category,
        priceCents: Math.round(Number(locForm.priceEgp) * 100),
        pricingUnit: locForm.pricingUnit,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setBanner({ type: "error", text: json.error || "تعذر إضافة الاستوديو/المكان." });
      return;
    }
    setBanner({ type: "success", text: "تمت إضافة الاستوديو/المكان بنجاح." });
    setLocForm({
      name: "",
      slug: "",
      description: "",
      city: "",
      address: "",
      category: "studio",
      priceEgp: "500",
      pricingUnit: "hour",
    });
    await loadListings();
  }

  async function handleCreateEquipment(e) {
    e.preventDefault();
    const headers = await authHeaders();
    const res = await fetch("/api/equipment", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: eqForm.name.trim(),
        slug: eqForm.slug.trim(),
        description: eqForm.description.trim(),
        category: eqForm.category,
        condition: eqForm.condition,
        priceCents: Math.round(Number(eqForm.priceEgp) * 100),
        depositCents: Math.round(Number(eqForm.depositEgp) * 100),
        pricingUnit: eqForm.pricingUnit,
        city: eqForm.city.trim(),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setBanner({ type: "error", text: json.error || "تعذر إضافة المعدة." });
      return;
    }
    setBanner({ type: "success", text: "تمت إضافة المعدة بنجاح." });
    setEqForm({
      name: "",
      slug: "",
      description: "",
      category: "camera",
      condition: "excellent",
      priceEgp: "1200",
      depositEgp: "5000",
      pricingUnit: "day",
      city: "",
    });
    await loadListings();
  }

  async function handleSaveFreelancer(e) {
    e.preventDefault();
    const headers = await authHeaders();
    const res = await fetch("/api/freelancers/me", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        specialty: flForm.specialty.trim(),
        bio: flForm.bio.trim() || undefined,
        city: flForm.city.trim(),
        priceCents: Math.round(Number(flForm.priceEgp) * 100),
        pricingUnit: flForm.pricingUnit,
        isAvailable: flForm.isAvailable,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setBanner({ type: "error", text: json.error || "تعذر حفظ بروفايل الفريلانس." });
      return;
    }
    setBanner({ type: "success", text: "تم حفظ بروفايل الفريلانس بنجاح." });
    await loadListings();
  }

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: 20, fontFamily: "sans-serif" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          borderBottom: "1px solid #ddd",
          paddingBottom: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>ShootHub</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <SignedOut>
            <SignInButton />
            <SignUpButton />
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </header>

      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button type="button" onClick={() => setTab("locations")}>
          الاستوديوهات والأماكن ({locationsList.length})
        </button>
        <button type="button" onClick={() => setTab("equipment")}>
          المعدات ({equipmentList.length})
        </button>
        <button type="button" onClick={() => setTab("freelancers")}>
          الفريلانسرز ({freelancersList.length})
        </button>
        <button type="button" onClick={() => setTab("bookings")}>
          حجوزاتي والواردة
        </button>
        <button type="button" onClick={() => setTab("create")}>
          إضافة عنصر / بروفايل
        </button>
      </nav>

      {["locations", "equipment", "freelancers"].includes(tab) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            placeholder="فلترة بالمدينة (مثال: Cairo)"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
          />
          <button type="button" onClick={() => void loadListings()}>
            تحديث
          </button>
        </div>
      )}

      {banner && (
        <div
          style={{
            padding: 10,
            marginBottom: 16,
            borderRadius: 6,
            background: banner.type === "error" ? "#fde8e8" : "#e8f8ee",
            color: banner.type === "error" ? "#9b1c1c" : "#1e5631",
          }}
        >
          {banner.text}
        </div>
      )}

      {loading && <p>جاري التحميل...</p>}

      {tab === "locations" && (
        <div>
          {locationsList.map((loc) => (
            <div key={loc.id} style={{ border: "1px solid #ddd", padding: 12, marginBottom: 10 }}>
              <strong>{loc.name}</strong> — {loc.city} ({loc.category})
              <div>{loc.description}</div>
              <div>
                السعر: {formatMoney(loc.priceCents, loc.currency)} / {loc.pricingUnit}
              </div>
              <button type="button" onClick={() => openBooking("locations", loc)}>
                احجز الآن
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "equipment" && (
        <div>
          {equipmentList.map((item) => (
            <div key={item.id} style={{ border: "1px solid #ddd", padding: 12, marginBottom: 10 }}>
              <strong>{item.name}</strong> — {item.city} ({item.category})
              <div>{item.description}</div>
              <div>
                السعر: {formatMoney(item.priceCents, item.currency)} / {item.pricingUnit} | تأمين:{" "}
                {formatMoney(item.depositCents, item.currency)}
              </div>
              <button type="button" onClick={() => openBooking("equipment", item)}>
                احجز الآن
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "freelancers" && (
        <div>
          {freelancersList.map((fl) => (
            <div key={fl.id} style={{ border: "1px solid #ddd", padding: 12, marginBottom: 10 }}>
              <strong>{fl.specialty}</strong> — {fl.city}
              {fl.bio && <div>{fl.bio}</div>}
              <div>
                السعر: {formatMoney(fl.priceCents, fl.currency)} / {fl.pricingUnit}
              </div>
              <button type="button" onClick={() => openBooking("freelancers", fl)}>
                احجز الآن
              </button>
            </div>
          ))}
        </div>
      )}

      {bookingTarget.id && (
        <form
          onSubmit={(e) => void handleCreateBooking(e)}
          style={{ border: "2px solid #333", padding: 14, marginTop: 18, marginBottom: 18 }}
        >
          <h3>حجز: {bookingTarget.label}</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <label>
              من:
              <input
                type="datetime-local"
                required
                value={bookingTarget.startAt}
                onChange={(e) => setBookingTarget((p) => ({ ...p, startAt: e.target.value }))}
              />
            </label>
            <label>
              إلى:
              <input
                type="datetime-local"
                required
                value={bookingTarget.endAt}
                onChange={(e) => setBookingTarget((p) => ({ ...p, endAt: e.target.value }))}
              />
            </label>
          </div>
          <div style={{ marginBottom: 10 }}>
            <input
              type="text"
              placeholder="ملاحظات إضافية (اختياري)"
              value={bookingTarget.notes}
              onChange={(e) => setBookingTarget((p) => ({ ...p, notes: e.target.value }))}
              style={{ width: "100%", maxWidth: 420 }}
            />
          </div>
          <button type="submit">تأكيد الحجز</button>{" "}
          <button
            type="button"
            onClick={() => setBookingTarget((p) => ({ ...p, id: "", label: "" }))}
          >
            إلغاء
          </button>
        </form>
      )}

      {tab === "bookings" && (
        <div>
          {!isSignedIn ? (
            <p>سجّل دخولك لعرض حجوزاتك والحجوزات الواردة.</p>
          ) : (
            <>
              <h3>حجوزاتي</h3>
              {["locations", "equipment", "freelancers"].map((type) =>
                (myBookings[type] || []).map((b) => (
                  <div key={b.id} style={{ border: "1px solid #ddd", padding: 10, marginBottom: 8 }}>
                    <div>
                      النوع: {type} | الحالة: <strong>{b.status}</strong> | الإجمالي:{" "}
                      {formatMoney(b.totalPriceCents, b.currency)}
                    </div>
                    <div>
                      من: {new Date(b.startAt).toLocaleString()} — إلى:{" "}
                      {new Date(b.endAt).toLocaleString()}
                    </div>
                    {b.status !== "cancelled" && b.status !== "rejected" && (
                      <button
                        type="button"
                        onClick={() => void handleBookingStatus(type, b.id, "cancelled")}
                      >
                        إلغاء الحجز
                      </button>
                    )}
                  </div>
                ))
              )}

              <h3>الحجوزات الواردة (على عناصر أو بروفايل حسابك)</h3>
              {["locations", "equipment", "freelancers"].map((type) =>
                (incomingBookings[type] || []).map((b) => (
                  <div key={b.id} style={{ border: "1px solid #ddd", padding: 10, marginBottom: 8 }}>
                    <div>
                      النوع: {type} | الحالة: <strong>{b.status}</strong> | الإجمالي:{" "}
                      {formatMoney(b.totalPriceCents, b.currency)}
                    </div>
                    <div>
                      من: {new Date(b.startAt).toLocaleString()} — إلى:{" "}
                      {new Date(b.endAt).toLocaleString()}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <button
                        type="button"
                        onClick={() => void handleBookingStatus(type, b.id, "approved")}
                      >
                        قبول
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleBookingStatus(type, b.id, "rejected")}
                      >
                        رفض
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      )}

      {tab === "create" && (
        <div>
          {!isSignedIn ? (
            <p>سجّل دخولك لإضافة استوديو أو معدة أو حفظ بروفايل فريلانس.</p>
          ) : (
            <>
              <form onSubmit={(e) => void handleCreateLocation(e)} style={{ marginBottom: 24 }}>
                <h3>إضافة استوديو / مكان</h3>
                <input
                  placeholder="الاسم"
                  required
                  value={locForm.name}
                  onChange={(e) => setLocForm((p) => ({ ...p, name: e.target.value }))}
                />{" "}
                <input
                  placeholder="Slug (مثال: daylight-studio-1)"
                  required
                  value={locForm.slug}
                  onChange={(e) => setLocForm((p) => ({ ...p, slug: e.target.value }))}
                />{" "}
                <input
                  placeholder="المدينة"
                  required
                  value={locForm.city}
                  onChange={(e) => setLocForm((p) => ({ ...p, city: e.target.value }))}
                />{" "}
                <input
                  placeholder="العنوان"
                  required
                  value={locForm.address}
                  onChange={(e) => setLocForm((p) => ({ ...p, address: e.target.value }))}
                />
                <div style={{ marginTop: 8 }}>
                  <input
                    placeholder="الوصف"
                    required
                    value={locForm.description}
                    onChange={(e) => setLocForm((p) => ({ ...p, description: e.target.value }))}
                  />{" "}
                  <select
                    value={locForm.category}
                    onChange={(e) => setLocForm((p) => ({ ...p, category: e.target.value }))}
                  >
                    <option value="studio">studio</option>
                    <option value="villa">villa</option>
                    <option value="rooftop">rooftop</option>
                    <option value="garden">garden</option>
                    <option value="other">other</option>
                  </select>{" "}
                  <input
                    type="number"
                    placeholder="السعر (EGP)"
                    required
                    value={locForm.priceEgp}
                    onChange={(e) => setLocForm((p) => ({ ...p, priceEgp: e.target.value }))}
                  />{" "}
                  <select
                    value={locForm.pricingUnit}
                    onChange={(e) => setLocForm((p) => ({ ...p, pricingUnit: e.target.value }))}
                  >
                    <option value="hour">hour</option>
                    <option value="day">day</option>
                  </select>{" "}
                  <button type="submit">حفظ المكان</button>
                </div>
              </form>

              <form onSubmit={(e) => void handleCreateEquipment(e)} style={{ marginBottom: 24 }}>
                <h3>إضافة معدة</h3>
                <input
                  placeholder="الاسم"
                  required
                  value={eqForm.name}
                  onChange={(e) => setEqForm((p) => ({ ...p, name: e.target.value }))}
                />{" "}
                <input
                  placeholder="Slug (مثال: sony-fx3-body)"
                  required
                  value={eqForm.slug}
                  onChange={(e) => setEqForm((p) => ({ ...p, slug: e.target.value }))}
                />{" "}
                <input
                  placeholder="المدينة"
                  required
                  value={eqForm.city}
                  onChange={(e) => setEqForm((p) => ({ ...p, city: e.target.value }))}
                />{" "}
                <select
                  value={eqForm.category}
                  onChange={(e) => setEqForm((p) => ({ ...p, category: e.target.value }))}
                >
                  <option value="camera">camera</option>
                  <option value="lens">lens</option>
                  <option value="lighting">lighting</option>
                  <option value="audio">audio</option>
                  <option value="stabilizer">stabilizer</option>
                  <option value="other">other</option>
                </select>
                <div style={{ marginTop: 8 }}>
                  <input
                    placeholder="الوصف"
                    required
                    value={eqForm.description}
                    onChange={(e) => setEqForm((p) => ({ ...p, description: e.target.value }))}
                  />{" "}
                  <input
                    type="number"
                    placeholder="السعر (EGP)"
                    required
                    value={eqForm.priceEgp}
                    onChange={(e) => setEqForm((p) => ({ ...p, priceEgp: e.target.value }))}
                  />{" "}
                  <input
                    type="number"
                    placeholder="التأمين (EGP)"
                    value={eqForm.depositEgp}
                    onChange={(e) => setEqForm((p) => ({ ...p, depositEgp: e.target.value }))}
                  />{" "}
                  <select
                    value={eqForm.pricingUnit}
                    onChange={(e) => setEqForm((p) => ({ ...p, pricingUnit: e.target.value }))}
                  >
                    <option value="day">day</option>
                    <option value="hour">hour</option>
                  </select>{" "}
                  <button type="submit">حفظ المعدة</button>
                </div>
              </form>

              <form onSubmit={(e) => void handleSaveFreelancer(e)}>
                <h3>بروفايل الفريلانس الخاص بي</h3>
                <input
                  placeholder="التخصص (مثال: photographer)"
                  required
                  value={flForm.specialty}
                  onChange={(e) => setFlForm((p) => ({ ...p, specialty: e.target.value }))}
                />{" "}
                <input
                  placeholder="المدينة"
                  required
                  value={flForm.city}
                  onChange={(e) => setFlForm((p) => ({ ...p, city: e.target.value }))}
                />{" "}
                <input
                  placeholder="نبذة مختصرة"
                  value={flForm.bio}
                  onChange={(e) => setFlForm((p) => ({ ...p, bio: e.target.value }))}
                />{" "}
                <input
                  type="number"
                  placeholder="السعر (EGP)"
                  required
                  value={flForm.priceEgp}
                  onChange={(e) => setFlForm((p) => ({ ...p, priceEgp: e.target.value }))}
                />{" "}
                <select
                  value={flForm.pricingUnit}
                  onChange={(e) => setFlForm((p) => ({ ...p, pricingUnit: e.target.value }))}
                >
                  <option value="day">day</option>
                  <option value="hour">hour</option>
                </select>{" "}
                <button type="submit">حفظ البروفايل</button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}