using System.Globalization;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Vehicules.Web;
using Vehicules.Web.Services;

CultureInfo.DefaultThreadCurrentCulture = Format.Fr;
CultureInfo.DefaultThreadCurrentUICulture = Format.Fr;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

// wwwroot/appsettings.json : adresse et clé publique du projet Supabase.
// Laissées vides, l'application garde les données dans le navigateur.
var supabase = new OptionsSupabase(builder.Configuration["Supabase:Url"], builder.Configuration["Supabase:AnonKey"]);
builder.Services.AddSingleton(supabase);

builder.Services.AddScoped(_ => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
builder.Services.AddScoped<ClientSupabase>();
if (supabase.Configure)
    builder.Services.AddScoped<IDepot, DepotSupabase>();
else
    builder.Services.AddScoped<IDepot, DepotNavigateur>();
builder.Services.AddScoped<Etat>();
builder.Services.AddScoped<ServiceDiagnostic>();
builder.Services.AddScoped<ServicePhotos>();
builder.Services.AddScoped<ServiceModeles3D>();

await builder.Build().RunAsync();
