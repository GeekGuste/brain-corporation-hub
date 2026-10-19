using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BrainHub.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Inscriptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "creneau",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Debut = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Fin = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Capacite = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_creneau", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "cohorte",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BarreauRequis = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    CategorieCode = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: true),
                    DateCreation = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreneauId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cohorte", x => x.Id);
                    table.ForeignKey(
                        name: "FK_cohorte_creneau_CreneauId",
                        column: x => x.CreneauId,
                        principalTable: "creneau",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "inscription",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nom = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Prenom = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    Telephone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    StatutResidence = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    CategorieCode = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    SousCategorieId = table.Column<int>(type: "integer", nullable: true),
                    PrecisionAutreSituation = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    DepartementPrefecture = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    PrefectureLibelle = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TribunalJudiciaireReference = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    BarreauRequis = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    PaysResidenceActuelle = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DateArriveePrevisionnelle = table.Column<DateOnly>(type: "date", nullable: true),
                    CommuneOuCodePostalProjete = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Statut = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    DateSoumission = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    DateValidation = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IdentifiantPaymentIntent = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    FormationSuivie = table.Column<bool>(type: "boolean", nullable: true),
                    CohorteId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inscription", x => x.Id);
                    table.ForeignKey(
                        name: "FK_inscription_categorie_titre_sejour_CategorieCode",
                        column: x => x.CategorieCode,
                        principalTable: "categorie_titre_sejour",
                        principalColumn: "Code",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inscription_cohorte_CohorteId",
                        column: x => x.CohorteId,
                        principalTable: "cohorte",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_inscription_referentiel_territorial_DepartementPrefecture",
                        column: x => x.DepartementPrefecture,
                        principalTable: "referentiel_territorial",
                        principalColumn: "Departement",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inscription_sous_categorie_titre_sejour_SousCategorieId",
                        column: x => x.SousCategorieId,
                        principalTable: "sous_categorie_titre_sejour",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_cohorte_CreneauId",
                table: "cohorte",
                column: "CreneauId");

            migrationBuilder.CreateIndex(
                name: "IX_inscription_BarreauRequis",
                table: "inscription",
                column: "BarreauRequis");

            migrationBuilder.CreateIndex(
                name: "IX_inscription_CategorieCode",
                table: "inscription",
                column: "CategorieCode");

            migrationBuilder.CreateIndex(
                name: "IX_inscription_CohorteId",
                table: "inscription",
                column: "CohorteId");

            migrationBuilder.CreateIndex(
                name: "IX_inscription_DateValidation",
                table: "inscription",
                column: "DateValidation");

            migrationBuilder.CreateIndex(
                name: "IX_inscription_DepartementPrefecture",
                table: "inscription",
                column: "DepartementPrefecture");

            migrationBuilder.CreateIndex(
                name: "IX_inscription_Email",
                table: "inscription",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_inscription_IdentifiantPaymentIntent",
                table: "inscription",
                column: "IdentifiantPaymentIntent",
                unique: true,
                filter: "\"IdentifiantPaymentIntent\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_inscription_SousCategorieId",
                table: "inscription",
                column: "SousCategorieId");

            migrationBuilder.CreateIndex(
                name: "IX_inscription_Statut_DateSoumission",
                table: "inscription",
                columns: new[] { "Statut", "DateSoumission" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "inscription");

            migrationBuilder.DropTable(
                name: "cohorte");

            migrationBuilder.DropTable(
                name: "creneau");
        }
    }
}
