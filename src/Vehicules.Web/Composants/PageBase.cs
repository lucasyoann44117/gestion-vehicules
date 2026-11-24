using Microsoft.AspNetCore.Components;
using Vehicules.Web.Services;

namespace Vehicules.Web.Composants;

/// <summary>Base des écrans : se redessine quand les données ou le véhicule choisi changent.</summary>
public abstract class PageBase : ComponentBase, IDisposable
{
    [Inject] protected Etat Etat { get; set; } = default!;

    protected override void OnInitialized() => Etat.Change += Rafraichir;

    private void Rafraichir() => InvokeAsync(StateHasChanged);

    public virtual void Dispose()
    {
        Etat.Change -= Rafraichir;
        GC.SuppressFinalize(this);
    }
}
