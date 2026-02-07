document.getElementById("ping").onclick = async () => {
  const res = await fetch("http://localhost:3000/api/health");
  const data = await res.json();
  alert(JSON.stringify(data));
};
