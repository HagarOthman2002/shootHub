import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";

function formatMoney(cents, currency = "EGP") {
  const amount = ((Number(cents) || 0) / 100).toFixed(0);
  return `${amount} ${currency}`;
}

function toIsoString(localInput) {
  if (!localInput) return null;
  const dt = new Date(localInput);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function estimateTotalCents(priceCents, pricingUnit, startStr, endStr) {
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return null;
  }
  const diffMs = end.getTime() - start.getTime();
  const unitMs = pricingUnit === "hour" ? 1000 * 60 * 60 : 1000 * 60 * 60 * 24;
  const units = Math.max(1, Math.ceil(diffMs / unitMs));
  return units * Number(priceCents || 0);
}

export default function App() {
  const { getToken, isSignedIn } = useAuth();

  const [tab, setTab] = useState("locations");
  const [cityFilter, setCityFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);

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

  const [bookingTarget, setBookingTarget] = useState({
    type: "locations",
    id: "",
    label: "",
    priceCents: 0,
    pricingUnit: "hour",
    currency: "EGP",
    startAt: "",
    endAt: "",
    notes: "",
  });

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
        setMyBookings(myJson.data ?? { locations: [], equipment: [], freelancers: [] });
      }
      if (incRes.ok) {
        const incJson = await incRes.json();
        setIncomingBookings(incJson.data ?? { locations: [], equipment: [], freelancers: [] });
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

  const previewTotalCents = useMemo(
    () =>
      estimateTotalCents(
        bookingTarget.priceCents,
        bookingTarget.pricingUnit,
        bookingTarget.startAt,
        bookingTarget.endAt
      ),
    [bookingTarget]
  );

  function openBooking(type, item) {
    const label =
      type === "locations"
        ? `${item.name} — ${item.city}`
        : type === "equipment"
        ? `${item.name} — ${item.city}`
        : `${item.specialty} — ${item.city}`;

    setBookingTarget({
      type,
      id: item.id,
      label,
      priceCents: item.priceCents,
      pricingUnit: item.pricingUnit || "hour",
      currency: item.currency || "EGP",
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
    setBookingTarget((p) => ({ ...p, id: "", label: "", startAt: "", endAt: "", notes: "" }));
    setTab("bookings");
    await loadBookings();
  }

  async function handleBookingStatus(type, bookingId, status) {
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
    setBanner({ type: "success", text: `تم تحديث الحالة إلى ${status}.` });
    await loadBookings();
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
    <div className="container">
      <header className="topbar">
        <div className="brand">
          Shoot<span>Hub</span>
        </div>
        <div className="auth-actions">
          <SignedOut>
            <SignInButton />
            <SignUpButton />
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </header>

      <nav className="tabs">
        <button
          type="button"
          className={`tab-btn ${tab === "locations" ? "active" : ""}`}
          onClick={() => setTab("locations")}
        >
          استوديوهات وأماكن ({locationsList.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${tab === "equipment" ? "active" : ""}`}
          onClick={() => setTab("equipment")}
        >
          معدات ({equipmentList.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${tab === "freelancers" ? "active" : ""}`}
          onClick={() => setTab("freelancers")}
        >
          فريلانسرز ({freelancersList.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${tab === "bookings" ? "active" : ""}`}
          onClick={() => setTab("bookings")}
        >
          حجوزاتي والواردة
        </button>
        <button
          type="button"
          className={`tab-btn ${tab === "create" ? "active" : ""}`}
          onClick={() => setTab("create")}
        >
          إضافة عنصر / بروفايل
        </button>
      </nav>

      {["locations", "equipment", "freelancers"].includes(tab) && (
        <div className="filter-bar">
          <input
            type="text"
            placeholder="ابحث بالمدينة (مثال: Cairo)"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
          />
          <button type="button" className="btn" onClick={() => void loadListings()}>
            تحديث النتائج
          </button>
          {cityFilter && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setCityFilter("");
              }}
            >
              مسح الفلتر
            </button>
          )}
        </div>
      )}

      {banner && <div className={`banner ${banner.type}`}>{banner.text}</div>}
      {loading && <p>جاري التحميل...</p>}

      {tab === "locations" && (
        <div className="grid">
          {locationsList.map((loc) => (
            <article key={loc.id} className="card">
              <div className="card-media">
                <span className="pill">{loc.category}</span>
                <span className="pill">{loc.city}</span>
              </div>
              <div className="card-body">
                <h3 className="card-title">{loc.name}</h3>
                <p className="card-desc">{loc.description}</p>
                <div className="card-footer">
                  <div className="price">
                    {formatMoney(loc.priceCents, loc.currency)}{" "}
                    <small>/ {loc.pricingUnit}</small>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => openBooking("locations", loc)}
                  >
                    احجز
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === "equipment" && (
        <div className="grid">
          {equipmentList.map((item) => (
            <article key={item.id} className="card">
              <div className="card-media">
                <span className="pill">{item.category}</span>
                <span className="pill">{item.city}</span>
              </div>
              <div className="card-body">
                <h3 className="card-title">{item.name}</h3>
                <p className="card-desc">{item.description}</p>
                <p className="card-desc">
                  تأمين: {formatMoney(item.depositCents, item.currency)}
                </p>
                <div className="card-footer">
                  <div className="price">
                    {formatMoney(item.priceCents, item.currency)}{" "}
                    <small>/ {item.pricingUnit}</small>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => openBooking("equipment", item)}
                  >
                    احجز
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === "freelancers" && (
        <div className="grid">
          {freelancersList.map((fl) => (
            <article key={fl.id} className="card">
              <div className="card-media">
                <span className="pill">{fl.specialty}</span>
                <span className="pill">{fl.city}</span>
              </div>
              <div className="card-body">
                <h3 className="card-title">{fl.specialty}</h3>
                <p className="card-desc">{fl.bio || "متاح لحجوزات التصوير والإنتاج."}</p>
                <div className="card-footer">
                  <div className="price">
                    {formatMoney(fl.priceCents, fl.currency)}{" "}
                    <small>/ {fl.pricingUnit}</small>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => openBooking("freelancers", fl)}
                  >
                    احجز
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {bookingTarget.id && (
        <form className="panel" onSubmit={(e) => void handleCreateBooking(e)}>
          <h3>حجز: {bookingTarget.label}</h3>
          <div className="form-row">
            <label>
              من:{" "}
              <input
                type="datetime-local"
                required
                value={bookingTarget.startAt}
                onChange={(e) => setBookingTarget((p) => ({ ...p, startAt: e.target.value }))}
              />
            </label>
            <label>
              إلى:{" "}
              <input
                type="datetime-local"
                required
                value={bookingTarget.endAt}
                onChange={(e) => setBookingTarget((p) => ({ ...p, endAt: e.target.value }))}
              />
            </label>
            <input
              type="text"
              placeholder="ملاحظات (اختياري)"
              value={bookingTarget.notes}
              onChange={(e) => setBookingTarget((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          {previewTotalCents !== null && (
            <p className="price">
              التكلفة التقديرية: {formatMoney(previewTotalCents, bookingTarget.currency)}
            </p>
          )}
          <div className="form-row">
            <button type="submit" className="btn btn-primary">
              تأكيد الحجز
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setBookingTarget((p) => ({ ...p, id: "", label: "" }))}
            >
              إلغاء
            </button>
          </div>
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
                  <div key={b.id} className="booking-card">
                    <div className="form-row">
                      <strong>{type}</strong>
                      <span className={`status-badge ${b.status}`}>{b.status}</span>
                      <span>الإجمالي: {formatMoney(b.totalPriceCents, b.currency)}</span>
                    </div>
                    <p className="card-desc">
                      من {new Date(b.startAt).toLocaleString()} إلى {new Date(b.endAt).toLocaleString()}
                    </p>
                    {b.status !== "cancelled" && b.status !== "rejected" && (
                      <button
                        type="button"
                        className="btn btn-reject"
                        onClick={() => void handleBookingStatus(type, b.id, "cancelled")}
                      >
                        إلغاء الحجز
                      </button>
                    )}
                  </div>
                ))
              )}

              <h3>الحجوزات الواردة</h3>
              {["locations", "equipment", "freelancers"].map((type) =>
                (incomingBookings[type] || []).map((b) => (
                  <div key={b.id} className="booking-card">
                    <div className="form-row">
                      <strong>{type}</strong>
                      <span className={`status-badge ${b.status}`}>{b.status}</span>
                      <span>الإجمالي: {formatMoney(b.totalPriceCents, b.currency)}</span>
                    </div>
                    <p className="card-desc">
                      من {new Date(b.startAt).toLocaleString()} إلى {new Date(b.endAt).toLocaleString()}
                    </p>
                    <div className="form-row">
                      <button
                        type="button"
                        className="btn btn-approve"
                        onClick={() => void handleBookingStatus(type, b.id, "approved")}
                      >
                        قبول
                      </button>
                      <button
                        type="button"
                        className="btn btn-reject"
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
              <form className="panel" onSubmit={(e) => void handleCreateLocation(e)}>
                <h3>إضافة استوديو / مكان</h3>
                <div className="form-row">
                  <input
                    placeholder="الاسم"
                    required
                    value={locForm.name}
                    onChange={(e) => setLocForm((p) => ({ ...p, name: e.target.value }))}
                  />
                  <input
                    placeholder="Slug (مثال: daylight-studio-1)"
                    required
                    value={locForm.slug}
                    onChange={(e) => setLocForm((p) => ({ ...p, slug: e.target.value }))}
                  />
                  <input
                    placeholder="المدينة"
                    required
                    value={locForm.city}
                    onChange={(e) => setLocForm((p) => ({ ...p, city: e.target.value }))}
                  />
                  <input
                    placeholder="العنوان"
                    required
                    value={locForm.address}
                    onChange={(e) => setLocForm((p) => ({ ...p, address: e.target.value }))}
                  />
                </div>
                <div className="form-row">
                  <input
                    placeholder="الوصف"
                    required
                    value={locForm.description}
                    onChange={(e) => setLocForm((p) => ({ ...p, description: e.target.value }))}
                  />
                  <select
                    value={locForm.category}
                    onChange={(e) => setLocForm((p) => ({ ...p, category: e.target.value }))}
                  >
                    <option value="studio">studio</option>
                    <option value="villa">villa</option>
                    <option value="rooftop">rooftop</option>
                    <option value="garden">garden</option>
                    <option value="other">other</option>
                  </select>
                  <input
                    type="number"
                    placeholder="السعر (EGP)"
                    required
                    value={locForm.priceEgp}
                    onChange={(e) => setLocForm((p) => ({ ...p, priceEgp: e.target.value }))}
                  />
                  <select
                    value={locForm.pricingUnit}
                    onChange={(e) => setLocForm((p) => ({ ...p, pricingUnit: e.target.value }))}
                  >
                    <option value="hour">hour</option>
                    <option value="day">day</option>
                  </select>
                  <button type="submit" className="btn btn-primary">
                    حفظ المكان
                  </button>
                </div>
              </form>

              <form className="panel" onSubmit={(e) => void handleCreateEquipment(e)}>
                <h3>إضافة معدة</h3>
                <div className="form-row">
                  <input
                    placeholder="الاسم"
                    required
                    value={eqForm.name}
                    onChange={(e) => setEqForm((p) => ({ ...p, name: e.target.value }))}
                  />
                  <input
                    placeholder="Slug (مثال: sony-fx3-body)"
                    required
                    value={eqForm.slug}
                    onChange={(e) => setEqForm((p) => ({ ...p, slug: e.target.value }))}
                  />
                  <input
                    placeholder="المدينة"
                    required
                    value={eqForm.city}
                    onChange={(e) => setEqForm((p) => ({ ...p, city: e.target.value }))}
                  />
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
                </div>
                <div className="form-row">
                  <input
                    placeholder="الوصف"
                    required
                    value={eqForm.description}
                    onChange={(e) => setEqForm((p) => ({ ...p, description: e.target.value }))}
                  />
                  <input
                    type="number"
                    placeholder="السعر (EGP)"
                    required
                    value={eqForm.priceEgp}
                    onChange={(e) => setEqForm((p) => ({ ...p, priceEgp: e.target.value }))}
                  />
                  <input
                    type="number"
                    placeholder="التأمين (EGP)"
                    value={eqForm.depositEgp}
                    onChange={(e) => setEqForm((p) => ({ ...p, depositEgp: e.target.value }))}
                  />
                  <select
                    value={eqForm.pricingUnit}
                    onChange={(e) => setEqForm((p) => ({ ...p, pricingUnit: e.target.value }))}
                  >
                    <option value="day">day</option>
                    <option value="hour">hour</option>
                  </select>
                  <button type="submit" className="btn btn-primary">
                    حفظ المعدة
                  </button>
                </div>
              </form>

              <form className="panel" onSubmit={(e) => void handleSaveFreelancer(e)}>
                <h3>بروفايل الفريلانس الخاص بي</h3>
                <div className="form-row">
                  <input
                    placeholder="التخصص (مثال: photographer)"
                    required
                    value={flForm.specialty}
                    onChange={(e) => setFlForm((p) => ({ ...p, specialty: e.target.value }))}
                  />
                  <input
                    placeholder="المدينة"
                    required
                    value={flForm.city}
                    onChange={(e) => setFlForm((p) => ({ ...p, city: e.target.value }))}
                  />
                  <input
                    placeholder="نبذة مختصرة"
                    value={flForm.bio}
                    onChange={(e) => setFlForm((p) => ({ ...p, bio: e.target.value }))}
                  />
                  <input
                    type="number"
                    placeholder="السعر (EGP)"
                    required
                    value={flForm.priceEgp}
                    onChange={(e) => setFlForm((p) => ({ ...p, priceEgp: e.target.value }))}
                  />
                  <select
                    value={flForm.pricingUnit}
                    onChange={(e) => setFlForm((p) => ({ ...p, pricingUnit: e.target.value }))}
                  >
                    <option value="day">day</option>
                    <option value="hour">hour</option>
                  </select>
                  <button type="submit" className="btn btn-primary">
                    حفظ البروفايل
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}