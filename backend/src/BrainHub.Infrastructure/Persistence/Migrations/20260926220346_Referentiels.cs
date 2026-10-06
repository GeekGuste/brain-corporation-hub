using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace BrainHub.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Referentiels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "categorie_titre_sejour",
                columns: table => new
                {
                    Code = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    Famille = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    PrecisionLibreObligatoire = table.Column<bool>(type: "boolean", nullable: false),
                    Ordre = table.Column<int>(type: "integer", nullable: false),
                    Actif = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_categorie_titre_sejour", x => x.Code);
                });

            migrationBuilder.CreateTable(
                name: "referentiel_territorial",
                columns: table => new
                {
                    Departement = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    NomDepartement = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Prefecture = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TribunalJudiciaire = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    BarreauRequis = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    DateDerniereVerification = table.Column<DateOnly>(type: "date", nullable: true),
                    Actif = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_referentiel_territorial", x => x.Departement);
                });

            migrationBuilder.CreateTable(
                name: "sous_categorie_titre_sejour",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CategorieCode = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    Libelle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Ordre = table.Column<int>(type: "integer", nullable: false),
                    Actif = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sous_categorie_titre_sejour", x => x.Id);
                    table.ForeignKey(
                        name: "FK_sous_categorie_titre_sejour_categorie_titre_sejour_Categori~",
                        column: x => x.CategorieCode,
                        principalTable: "categorie_titre_sejour",
                        principalColumn: "Code",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_categorie_titre_sejour_Actif",
                table: "categorie_titre_sejour",
                column: "Actif");

            migrationBuilder.CreateIndex(
                name: "IX_referentiel_territorial_Actif",
                table: "referentiel_territorial",
                column: "Actif");

            migrationBuilder.CreateIndex(
                name: "IX_referentiel_territorial_Prefecture",
                table: "referentiel_territorial",
                column: "Prefecture");

            migrationBuilder.CreateIndex(
                name: "IX_sous_categorie_titre_sejour_CategorieCode_Libelle",
                table: "sous_categorie_titre_sejour",
                columns: new[] { "CategorieCode", "Libelle" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "referentiel_territorial");

            migrationBuilder.DropTable(
                name: "sous_categorie_titre_sejour");

            migrationBuilder.DropTable(
                name: "categorie_titre_sejour");
        }
    }
}
