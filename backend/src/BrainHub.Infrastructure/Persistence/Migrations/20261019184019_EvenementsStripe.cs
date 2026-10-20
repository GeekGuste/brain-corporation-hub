using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BrainHub.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EvenementsStripe : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "evenement_stripe_traite",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DateTraitement = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_evenement_stripe_traite", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_evenement_stripe_traite_DateTraitement",
                table: "evenement_stripe_traite",
                column: "DateTraitement");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "evenement_stripe_traite");
        }
    }
}
