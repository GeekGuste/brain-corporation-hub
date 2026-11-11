import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Logo de Lignes Rouges, dessine dans la page.
 *
 * INTEGRE et non charge comme image, pour deux raisons.
 *
 * Son texte est en vrais caracteres et le fichier n'embarque aucune police :
 * charge par une balise image, il s'afficherait dans la police de repli du
 * systeme, donc deforme. Integre, il herite de l'Open Sans que nous hebergeons.
 *
 * Et sa couleur suit celle du contexte : noir sur fond clair, blanc sur l'encre
 * profonde du bandeau. C'est la version « sur fond colore » que la charte
 * prevoit page 2 mais qui n'a pas ete livree. Les deux rubans, eux, gardent
 * leurs couleurs de marque.
 *
 * Decoratif : le nom du programme est porte par le titre de la page juste en
 * dessous, le logo n'a donc pas a etre annonce une seconde fois.
 */
@Component({
  selector: 'app-logo-lignes-rouges',
  templateUrl: './logo-lignes-rouges.html',
  styleUrl: './logo-lignes-rouges.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'd-block' },
})
export class LogoLignesRouges {}
